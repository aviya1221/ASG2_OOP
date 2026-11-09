import { describe, expect, it } from "vitest";
import { parseStudents, problemsIn, saveErrorMessage, type CourseForm } from "../src/timetable/courseForm.ts";

const VALID: CourseForm = {
  number: "101",
  name: "מבוא",
  teacherId: "200000001",
  teacherName: "מרצה",
  slots: [{ day: 0, start: "10:00", end: "12:00" }],
  firstDate: "2027-01-03",
  weeks: "13",
  students: "300000001 נועה ברק",
};

describe("parseStudents", () => {
  it("reads a line with a space, a comma or a tab, and skips empty lines", () => {
    const { students, badLines } = parseStudents("300000001 נועה ברק\n\n300000002,יואב מזרחי\n300000003\tדנה לוי\n");
    expect(students).toEqual([
      { id_number: "300000001", name: "נועה ברק" },
      { id_number: "300000002", name: "יואב מזרחי" },
      { id_number: "300000003", name: "דנה לוי" },
    ]);
    expect(badLines).toEqual([]);
  });

  it("reports a line with no name or with a wrong ID number", () => {
    expect(parseStudents("300000001\nabc דנה").badLines).toEqual(["300000001", "abc דנה"]);
  });
});

describe("problemsIn", () => {
  it("finds nothing in a complete form", () => {
    expect(problemsIn(VALID)).toEqual([]);
  });

  it("says what to fix for each missing detail", () => {
    const problems = problemsIn({ ...VALID, number: "", name: " ", teacherId: "12", teacherName: "", firstDate: "", weeks: "0", students: "" });
    expect(problems).toHaveLength(7);
    expect(problems).toContain("חסר מספר קורס.");
    expect(problems).toContain("חסרה רשימת סטודנטים.");
  });

  it("refuses an hour that ends before it starts", () => {
    expect(problemsIn({ ...VALID, slots: [{ day: 0, start: "12:00", end: "10:00" }] })).toEqual(["שעת הסיום צריכה להיות אחרי שעת ההתחלה."]);
  });
});

describe("saveErrorMessage", () => {
  it("turns a known refusal into a clear message, and anything else into a general one", () => {
    expect(saveErrorMessage("course_number_exists")).toBe("מספר הקורס הזה כבר קיים.");
    expect(saveErrorMessage("something else")).toBe("השמירה נכשלה. כדאי לנסות שוב.");
  });
});
