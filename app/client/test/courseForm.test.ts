import { describe, expect, it } from "vitest";
import { parseStudents, problemsIn, saveErrorMessage, type CourseForm } from "../src/timetable/courseForm.ts";

const VALID: CourseForm = {
  number: "101",
  name: "מבוא",
  teacherEmail: "teacher@example.com",
  teacherName: "מרצה",
  slots: [{ day: 0, start: "10:00", end: "12:00" }],
  firstDate: "2027-01-03",
  weeks: "13",
  students: "noa@example.com נועה ברק",
};

describe("parseStudents", () => {
  it("reads a line with a space, a comma or a tab, and skips empty lines", () => {
    const { students, badLines } = parseStudents("Noa@Example.com נועה ברק\n\nyoav@example.com,יואב מזרחי\ndana@example.com\tדנה לוי\n");
    expect(students).toEqual([
      { email: "noa@example.com", name: "נועה ברק" },
      { email: "yoav@example.com", name: "יואב מזרחי" },
      { email: "dana@example.com", name: "דנה לוי" },
    ]);
    expect(badLines).toEqual([]);
  });

  it("reports a line with no name or with an email that is not complete", () => {
    expect(parseStudents("noa@example.com\n300000001 דנה").badLines).toEqual(["noa@example.com", "300000001 דנה"]);
  });
});

describe("problemsIn", () => {
  it("finds nothing in a complete form", () => {
    expect(problemsIn(VALID)).toEqual([]);
  });

  it("says what to fix for each missing detail", () => {
    const problems = problemsIn({ ...VALID, number: "", name: " ", teacherEmail: "teacher", teacherName: "", firstDate: "", weeks: "0", students: "" });
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
