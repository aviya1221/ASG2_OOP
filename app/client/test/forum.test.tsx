import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { splitLinks } from "../src/forum/MessageLinks.ts";
import { FormBuilder } from "../src/surveys/FormBuilder.tsx";
import { FormWindow } from "../src/surveys/FormWindow.tsx";
import { PollCard } from "../src/surveys/PollCard.tsx";
import { ResultsChart } from "../src/surveys/ResultsChart.tsx";
import type { Survey } from "../src/surveys/SurveyApi.ts";
import { missingAnswers, type Question } from "../src/surveys/questions.ts";

describe("MessageLinks", () => {
  it("TC-047 turns web addresses into links and keeps the rest as text", () => {
    expect(splitLinks("ראו https://example.com/a?b=1. ותודה")).toEqual([
      { kind: "text", value: "ראו " },
      { kind: "link", value: "https://example.com/a?b=1" },
      { kind: "text", value: ". ותודה" },
    ]);
  });

  it("TC-047 keeps a tag as text", () => {
    expect(splitLinks('<img src=x onerror="alert(1)">')).toEqual([{ kind: "text", value: '<img src=x onerror="alert(1)">' }]);
  });
});

const FORM: Question[] = [
  { id: "q1", type: "single", text: "בחירה אחת", options: ["א", "ב"] },
  { id: "q2", type: "multiple", text: "כמה בחירות", options: ["א", "ב", "ג"] },
  { id: "q3", type: "rating", text: "דירוג", scale: 5 },
  { id: "q4", type: "text", text: "מה עוד?" },
];

describe("missingAnswers", () => {
  it("TC-072 finds every question with no answer, including empty text and no choice", () => {
    expect(missingAnswers(FORM, { q1: 0, q2: [], q4: "  " }).map((q) => q.id)).toEqual(["q2", "q3", "q4"]);
    expect(missingAnswers(FORM, { q1: 1, q2: [0], q3: 5, q4: "כן" })).toEqual([]);
  });
});

describe("FormWindow", () => {
  it("TC-071 TC-072 shows each type with its own control, marks a missing answer, then sends answers of the right form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FormWindow questions={FORM} onSubmit={onSubmit} onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "שליחת התשובות" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText("צריך לענות על השאלה הזאת.")).toHaveLength(4);

    const group = (id: string) => within(document.querySelector(`[data-question="${id}"]`) as HTMLElement);
    await user.click(group("q1").getByLabelText("ב"));
    await user.click(group("q2").getByLabelText("א"));
    await user.click(group("q2").getByLabelText("ג"));
    await user.click(group("q3").getByLabelText("4"));
    await user.type(screen.getByLabelText("מה עוד?"), "תודה");
    await user.click(screen.getByRole("button", { name: "שליחת התשובות" }));

    expect(onSubmit).toHaveBeenCalledWith({ q1: 1, q2: [0, 2], q3: 4, q4: "תודה" });
  });
});

describe("FormBuilder", () => {
  it("TC-071 builds one question of each type and refuses a question with no text", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<FormBuilder onSave={onSave} onClose={() => {}} />);

    for (const label of ["+ בחירה יחידה", "+ בחירה מרובה", "+ דירוג בסולם", "+ טקסט חופשי"]) {
      await user.click(screen.getByRole("button", { name: label }));
    }
    await user.click(screen.getByRole("button", { name: "פרסום בפורום" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("לשאלה 1 חסר נוסח.");

    for (const [index, text] of ["אחת", "כמה", "דירוג", "חופשי"].entries()) {
      await user.type(screen.getByLabelText(`נוסח שאלה ${index + 1}`), text);
    }
    for (const question of [1, 2]) {
      await user.type(screen.getByLabelText(`שאלה ${question} אפשרות 1`), "כן");
      await user.type(screen.getByLabelText(`שאלה ${question} אפשרות 2`), "לא");
    }
    await user.click(screen.getByRole("button", { name: "פרסום בפורום" }));

    const [questions, allowChange, publish] = onSave.mock.calls[0]!;
    expect(questions.map((q: Question) => q.type)).toEqual(["single", "multiple", "rating", "text"]);
    expect(questions[0].options).toEqual(["כן", "לא"]);
    expect(questions[2].scale).toBe(5);
    expect([allowChange, publish]).toEqual([false, true]);
  });
});

describe("ResultsChart", () => {
  it("TC-065 shows a bar per option that follows the totals", () => {
    render(<ResultsChart options={["כן", "לא"]} counts={[3, 1]} />);
    const rows = document.querySelectorAll(".result-row");
    expect((rows[0]!.querySelector(".bar") as HTMLElement).style.width).toBe("75%");
    expect(rows[1]).toHaveTextContent("1");
  });
});

describe("PollCard", () => {
  const POLL: Survey = {
    id: "p1",
    lessonId: "L1",
    kind: "poll",
    status: "open",
    allowChange: false,
    questions: [{ id: "q1", type: "single", text: "הבנתם?", options: ["כן", "לא"] }],
    shownAt: new Date(),
  };

  it("TC-063 shows the first answer, and no options, once the student answered and no change is allowed", () => {
    render(<PollCard survey={POLL} counts={[1, 0]} myAnswer={{ q1: 0 }} isTeacher={false} whoAnswered={[]} onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("בחרת: כן")).toBeVisible();
    expect(screen.queryByRole("group", { name: "אפשרויות הסקר" })).toBeNull();
  });

  it("offers no options once the poll is closed", () => {
    render(<PollCard survey={{ ...POLL, status: "closed" }} counts={[]} myAnswer={undefined} isTeacher={false} whoAnswered={[]} onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "אפשרויות הסקר" })).toBeNull();
    expect(screen.getByText("הסקר סגור")).toBeVisible();
  });

  it("shows the teacher who answered what", () => {
    render(
      <PollCard survey={POLL} counts={[1, 0]} myAnswer={undefined} isTeacher whoAnswered={[{ studentId: "1", name: "דנה", value: { q1: 0 } }]} onChoose={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText("דנה: כן")).toBeInTheDocument();
  });
});
