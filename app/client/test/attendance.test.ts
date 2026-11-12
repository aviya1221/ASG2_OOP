import { describe, expect, it, vi } from "vitest";
import { sheetCells, type SheetRow } from "../src/attendance/AttendanceSheet.ts";
import { claimText, claimTitle, countText, progressText } from "../src/attendance/attendanceText.ts";
import { numberFaces } from "../src/attendance/numberedPhoto.ts";

vi.mock("write-excel-file/browser", () => ({ default: vi.fn() }));
vi.mock("../src/lib/supabase.ts", () => ({ supabase: {} }));

describe("sheetCells", () => {
  const ROW: SheetRow = {
    idNumber: "012345678",
    name: "=דנה",
    attendance: "present",
    decidedBy: "photo_number",
    confirmed: true,
    changedByTeacher: false,
    claimNumber: 32,
    claimStatus: "pending",
    claimContested: false,
    flagged: true,
  };

  it("TC-028 gives the columns of REQ-19 as text", () => {
    const [cells] = sheetCells([ROW]);
    expect(cells).toEqual(["012345678", "=דנה", "נוכח", "מספר בתמונה", "בחירת מספר שנדחתה בקורס"]);
  });

  it("names every result and every way it was decided", () => {
    const cells = sheetCells([
      { ...ROW, attendance: "absent", decidedBy: null, flagged: false },
      { ...ROW, attendance: "present", decidedBy: "confirmation" },
      { ...ROW, attendance: "present", decidedBy: "teacher" },
      { ...ROW, attendance: "pending", decidedBy: null },
      { ...ROW, attendance: "no_photo", decidedBy: null },
    ]);
    expect(cells.map((row) => row.slice(2, 4))).toEqual([
      ["לא נוכח", ""],
      ["נוכח", "אישור עצמי"],
      ["נוכח", "החלטת המרצה"],
      ["ממתין", ""],
      ["לא צולם", ""],
    ]);
  });
});

describe("numberFaces", () => {
  it("puts a number on every face, from left to right", () => {
    const numbers = numberFaces([
      [300, 0, 40, 40],
      [10, 0, 40, 40],
      [150, 0, 40, 40],
    ]);
    expect(numbers.map((item) => [item.number, item.faceNo])).toEqual([
      [1, 1],
      [2, 2],
      [3, 0],
    ]);
    expect(numbers[0]).toEqual({ number: 1, photoNo: 0, faceNo: 1, box: [10, 0, 40, 40] });
    expect(numberFaces([])).toEqual([]);
  });
});

describe("countText", () => {
  it("says that every student who confirmed is present when no more confirmed than the faces", () => {
    expect(countText(38, 41)).toBe("38 סטודנטים אישרו, ובתמונה נמצאו 41 פרצופים. כל מי שאישר מסומן נוכח.");
    expect(countText(1, 1)).toBe("סטודנט אחד אישר, ובתמונה נמצא פרצוף אחד. כל מי שאישר מסומן נוכח.");
  });

  it("asks every student who confirmed to pick a number when more confirmed than the faces", () => {
    expect(countText(42, 41)).toBe("42 סטודנטים אישרו, אבל בתמונה נמצאו רק 41 פרצופים. כל מי שאישר צריך לבחור את המספר שלו בתמונת הכיתה.");
    expect(countText(2, 1)).toBe("2 סטודנטים אישרו, אבל בתמונה נמצא רק פרצוף אחד. כל מי שאישר צריך לבחור את המספר שלו בתמונת הכיתה.");
    expect(countText(1, 0)).toBe("סטודנט אחד אישר, אבל בתמונה לא נמצא אף פרצוף. כל מי שאישר צריך לבחור את המספר שלו בתמונת הכיתה.");
  });

  it("says when no student confirmed, also while the minutes run", () => {
    expect(countText(0, 41)).toBe("אף סטודנט לא אישר. בתמונה נמצאו 41 פרצופים.");
    expect(progressText(0, 41)).toBe("עוד אף סטודנט לא אישר. בתמונה נמצאו 41 פרצופים.");
    expect(progressText(12, 41)).toBe("עד עכשיו 12 סטודנטים אישרו. בתמונה נמצאו 41 פרצופים.");
  });
});

describe("claimText", () => {
  it("tells the student where their pick stands", () => {
    expect(claimText({ number: 21, status: "pending", contested: false })).toBe("נקלט");
    expect(claimText({ number: 21, status: "pending", contested: true })).toBe("הועבר למרצה להמשך טיפול");
    expect(claimText({ number: null, status: "pending", contested: false })).toBe("ממתין להחלטת המרצה");
    expect(claimText({ number: 21, status: "approved", contested: false })).toBe("אושר");
    expect(claimText({ number: 21, status: "rejected", contested: false })).toBe("נדחה");
  });

  it("names the pick, or the request of a student who is not in the photo", () => {
    expect(claimTitle({ number: 21, status: "pending", contested: false })).toBe("בחרת את מספר 21");
    expect(claimTitle({ number: null, status: "pending", contested: false })).toBe("ביקשת לסמן שאינך מופיע בתמונה");
  });
});
