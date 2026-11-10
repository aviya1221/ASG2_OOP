import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ClassChart, filterOptions, places } from "../src/homework/ClassChart.tsx";
import { ReportView } from "../src/homework/ReportView.tsx";
import { sectionLabel, type ChartRow, type Check } from "../src/homework/scores.ts";

const SECTIONS = (a: number, b: number, c: number) => [
  { id: "q1_a", question: 1, section: 1, score: a },
  { id: "q1_b", question: 1, section: 2, score: b },
  { id: "q2_a", question: 2, section: 1, score: c },
];

function row(name: string, overall: number, sections: [number, number, number], isMe = false): ChartRow {
  const all = SECTIONS(...sections);
  return {
    name,
    isMe,
    overall,
    questionScores: [
      { id: "q1", question: 1, score: (sections[0] + sections[1]) / 2 },
      { id: "q2", question: 2, score: sections[2] },
    ],
    sectionScores: all,
  };
}

const ROWS = [row("דנה", 80, [90, 70, 80]), row("יואב", 60, [40, 40, 100], true), row("מיכל", 80, [100, 100, 60])];

describe("ClassChart", () => {
  it("TC-137 equal scores share a place, and the next place skips: 1, 1, 3", () => {
    expect(places(ROWS, "overall").map(({ row, place }) => [row.name, place])).toEqual([
      ["דנה", 1],
      ["מיכל", 1],
      ["יואב", 3],
    ]);
  });

  it("TC-137 the filter by a question or a section changes the order", () => {
    expect(places(ROWS, "q:q2").map(({ row, score }) => [row.name, score])).toEqual([
      ["יואב", 100],
      ["דנה", 80],
      ["מיכל", 60],
    ]);
    expect(places(ROWS, "s:q1_b").map(({ row }) => row.name)).toEqual(["מיכל", "דנה", "יואב"]);
  });

  it("TC-137 marks the viewer's own place, and the filter reorders the chart on the page", async () => {
    const user = userEvent.setup();
    render(<ClassChart rows={ROWS} />);
    const chart = screen.getByRole("region", { name: "גרף הכיתה" });

    const mine = within(chart).getAllByRole("listitem").find((item) => item.getAttribute("aria-current") === "true")!;
    expect(mine).toHaveTextContent("3. יואב (המקום שלך)");

    await user.selectOptions(within(chart).getByLabelText("לפי"), "שאלה 2");
    expect(within(chart).getAllByRole("listitem")[0]).toHaveTextContent("1. יואב (המקום שלך)");
  });

  it("offers the sections only of questions that have more than one", () => {
    expect(filterOptions(ROWS).map((option) => option.label)).toEqual(["ציון כולל", "שאלה 1", "שאלה 2", "שאלה 1, סעיף א", "שאלה 1, סעיף ב"]);
    expect(sectionLabel(SECTIONS(1, 2, 3)[2]!, SECTIONS(1, 2, 3))).toBe("שאלה 2");
  });
});

describe("ReportView", () => {
  const CHECK: Check = {
    checkNumber: 2,
    overall: 35,
    questionScores: [
      { id: "q1", question: 1, score: 70.5 },
      { id: "q2", question: 2, score: 0 },
    ],
    report: {
      sections: [
        { id: "q1_a", question: 1, section: 1, score: 80, answered: true, meets: "הדרך מוסברת", missing: "חסר נימוק", direction: "לבדוק את המכנה" },
        { id: "q1_b", question: 1, section: 2, score: 61, answered: true, meets: "חישוב נכון", missing: "אין הסבר", direction: "להסביר כל שלב" },
        { id: "q2_a", question: 2, section: 1, score: 0, answered: false, meets: "", missing: "", direction: "" },
      ],
    },
  };

  it("TC-134 puts a notice of the sections that were not answered at the top, and gives them 0", () => {
    render(<ReportView check={CHECK} />);
    const report = screen.getByRole("region", { name: "הדוח שלך" });

    expect(within(report).getByRole("note")).toHaveTextContent("סעיפים שלא נענו וקיבלו 0: שאלה 2.");
    expect(within(report).getByRole("article", { name: "שאלה 2" })).toHaveTextContent("לא נענה: 0");
    expect(within(report).getByRole("article", { name: "שאלה 2" })).not.toHaveTextContent("מה חסר");
  });

  it("shows each answered section with its score and the three parts of the feedback, and the question scores", () => {
    render(<ReportView check={CHECK} />);
    const section = screen.getByRole("article", { name: "שאלה 1, סעיף א" });

    expect(section).toHaveTextContent("80 מתוך 100");
    for (const text of ["מה עומד בדרישות", "הדרך מוסברת", "מה חסר", "חסר נימוק", "כיוון לשיפור", "לבדוק את המכנה"]) expect(section).toHaveTextContent(text);
    expect(screen.getByRole("list", { name: "ציוני השאלות" })).toHaveTextContent("שאלה 1: 70.5");
    expect(screen.getByText("הדוח שלך: בדיקה 2 מתוך 3")).toBeInTheDocument();
  });
});
