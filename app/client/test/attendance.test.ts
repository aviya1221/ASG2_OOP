import { beforeEach, describe, expect, it, vi } from "vitest";
import { respondToOpenRounds } from "../src/attendance/AttendanceResponder.ts";
import { sheetCells, type SheetRow } from "../src/attendance/AttendanceSheet.ts";
import { FaceStore, hashOfPrint } from "../src/attendance/FaceStore.ts";
import { claimText, claimTitle, countText, progressText } from "../src/attendance/attendanceText.ts";
import { numberFaces } from "../src/attendance/numberedPhoto.ts";

const mocks = vi.hoisted(() => ({ rounds: [] as { lesson_id: string }[], results: [] as { lesson_id: string }[], callServer: vi.fn() }));

vi.mock("../src/lib/server.ts", () => ({ callServer: mocks.callServer }));
vi.mock("write-excel-file/browser", () => ({ default: vi.fn() }));
vi.mock("../src/lib/supabase.ts", () => {
  const query = (rows: () => unknown[]) => ({
    select: () => ({
      gt: async () => ({ data: rows() }),
      eq: () => ({ in: async () => ({ data: rows() }) }),
    }),
  });
  return {
    supabase: {
      from: (table: string) => query(() => (table === "attendance_rounds" ? mocks.rounds : mocks.results)),
    },
  };
});

const S1 = "300000001";

beforeEach(() => {
  localStorage.clear();
  mocks.rounds = [];
  mocks.results = [];
  mocks.callServer.mockReset().mockResolvedValue({ result: "present" });
});

describe("FaceStore", () => {
  it("TC-010 returns what was saved, unchanged", () => {
    const print = Float32Array.from({ length: 128 }, (_, i) => i / 128);
    FaceStore.save(S1, print, "abc");
    const stored = FaceStore.load(S1)!;
    expect(Float32Array.from(stored.print)).toEqual(print);
    expect(stored.hash).toBe("abc");
  });

  it("returns nothing for a student with no face-print on this phone", () => {
    expect(FaceStore.load("300000002")).toBeNull();
  });
});

describe("hashOfPrint", () => {
  it("gives the SHA-256 of the bytes, as the server calculates it", async () => {
    const hash = await hashOfPrint(new Float32Array(128));
    expect(hash).toBe("076a27c79e5ace2a3d47f9dd2e83e4ff6ea8872b3c2218f66c92b89b55f36560");
  });
});

describe("respondToOpenRounds", () => {
  function saveFace() {
    FaceStore.save(S1, new Float32Array(128), "hash-1");
  }

  it("TC-017 sends one response for each open round with no result", async () => {
    saveFace();
    mocks.rounds = [{ lesson_id: "L1" }, { lesson_id: "L2" }];
    mocks.results = [{ lesson_id: "L2" }];
    await respondToOpenRounds(S1);
    expect(mocks.callServer).toHaveBeenCalledTimes(1);
    expect(mocks.callServer.mock.calls[0]![1]).toMatchObject({ lessonId: "L1", hash: "hash-1" });
  });

  it("TC-012 sends nothing when this phone has no face-print", async () => {
    mocks.rounds = [{ lesson_id: "L1" }];
    await respondToOpenRounds(S1);
    expect(mocks.callServer).not.toHaveBeenCalled();
  });

  it("carries on when a response fails", async () => {
    saveFace();
    mocks.rounds = [{ lesson_id: "L1" }];
    mocks.callServer.mockRejectedValue(new Error("no network"));
    await expect(respondToOpenRounds(S1)).resolves.toBeUndefined();
  });
});

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
