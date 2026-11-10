import { describe, expect, it } from "vitest";
import { fromEditable, isStale, toEditable, type SummaryParts } from "../src/summaries/summaryText.ts";

const PARTS: SummaryParts = {
  overview: "השיעור עסק בהסתברות מותנית.",
  topics: [
    { start: "00:30", title: "הגדרה" },
    { start: "05:10", title: "דוגמה" },
  ],
  questions: [{ time: "07:00", question: "מה ההבדל?", answer: "המכנה משתנה." }],
  board: [{ time: "03:00", content: "P(A|B) = P(A∩B)/P(B)" }],
};

describe("the editable text of a summary", () => {
  it("TC-087 turns the four parts into lines and back without losing anything", () => {
    expect(fromEditable(toEditable(PARTS))).toEqual(PARTS);
  });

  it("reads a line the teacher typed without a time", () => {
    const parts = fromEditable({ overview: " תקציר ", topics: "נושא בלי זמן\n\n", questions: "08:00 | שאלה | תשובה", board: "" });
    expect(parts).toEqual({ overview: "תקציר", topics: [{ start: "", title: "נושא בלי זמן" }], questions: [{ time: "08:00", question: "שאלה", answer: "תשובה" }], board: [] });
  });
});

describe("isStale", () => {
  it("TC-102 shows a summary in progress as failed only after 15 minutes", () => {
    const started = new Date("2026-12-01T10:00:00Z");
    expect(isStale(started, new Date("2026-12-01T10:14:59Z"))).toBe(false);
    expect(isStale(started, new Date("2026-12-01T10:16:00Z"))).toBe(true);
  });
});
