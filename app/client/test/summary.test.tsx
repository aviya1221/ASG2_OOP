import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SummaryView } from "../src/summaries/SummaryPage.tsx";
import { isStale, MAX_SUMMARY_WORDS, summaryWords } from "../src/summaries/summaryText.ts";

const updates: unknown[] = [];
vi.mock("../src/lib/supabase.ts", () => ({
  supabase: {
    from: () => ({
      update: (values: unknown) => {
        updates.push(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

const BODY = `# הסתברות מותנית

השיעור הגדיר הסתברות מותנית והראה דוגמה.

## הגדרה

- **הסתברות מותנית** היא הסיכוי של A כשידוע ש־B קרה: \`P(A|B) = P(A∩B)/P(B)\`

## שאלות מהשיעור

- **מה ההבדל מחיתוך?** במותנית המכנה הוא P(B).

<img src=x onerror="alert(1)">`;

function show(isTeacher: boolean, published = false) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<SummaryView lessonId="L2" body={BODY} published={published} isTeacher={isTeacher} editable={isTeacher} onSaved={onSaved} />);
  return onSaved;
}

describe("the summary page", () => {
  it("TC-085 shows one page with headings, bold terms, the board formula inside its topic and the questions", () => {
    show(false);
    const page = screen.getByRole("article", { name: "הסיכום" });
    expect(within(page).getByRole("heading", { level: 1 })).toHaveTextContent("הסתברות מותנית");
    expect(within(page).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["הגדרה", "שאלות מהשיעור"]);
    expect(within(page).getByText("הסתברות מותנית", { selector: "strong" })).toBeVisible();
    expect(within(page).getByText("P(A|B) = P(A∩B)/P(B)", { selector: "code" })).toBeVisible();
    expect(page.querySelector("img")).toBeNull();
  });

  it("TC-143 the teacher sees that the summary is theirs only, and publishes it", async () => {
    const user = userEvent.setup();
    updates.length = 0;
    const onSaved = show(true);
    expect(screen.getByText("גלוי רק לך")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "פרסום לכיתה" }));
    expect(updates).toEqual([{ published: true }]);
    expect(onSaved).toHaveBeenCalled();
  });

  it("TC-143 the teacher hides a published summary, and a student has no tools", async () => {
    const user = userEvent.setup();
    updates.length = 0;
    show(true, true);
    expect(screen.getByText("פורסם לכיתה")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "הסתרה מהכיתה" }));
    expect(updates).toEqual([{ published: false }]);
  });

  it("gives a student the page and printing, but nothing to change", () => {
    show(false);
    expect(screen.queryByRole("button", { name: "עריכת הסיכום" })).toBeNull();
    expect(screen.queryByRole("button", { name: "פרסום לכיתה" })).toBeNull();
    expect(screen.getByRole("button", { name: "הדפסה" })).toBeVisible();
  });

  it("TC-087 the teacher edits the text, and cannot save more than a page", async () => {
    const user = userEvent.setup();
    updates.length = 0;
    show(true);
    await user.click(screen.getByRole("button", { name: "עריכת הסיכום" }));
    const box = screen.getByLabelText("הסיכום");
    await user.clear(box);
    await user.type(box, "# תוקן");
    await user.click(screen.getByRole("button", { name: "שמירה" }));
    expect(updates).toEqual([{ body: "# תוקן" }]);

    await user.click(screen.getByRole("button", { name: "עריכת הסיכום" }));
    await user.click(screen.getByLabelText("הסיכום"));
    await user.paste(` ${"מילה ".repeat(MAX_SUMMARY_WORDS)}`);
    expect(screen.getByRole("button", { name: "שמירה" })).toBeDisabled();
  });
});

describe("summaryWords", () => {
  it("counts the words a reader sees, not the marks of headings, points and bold text", () => {
    expect(summaryWords("# כותרת\n\n## משנה\n\n- **מונח** ועוד `x`\n1. שלב")).toBe(6);
  });
});

describe("isStale", () => {
  it("TC-102 shows a summary in progress as failed only after 15 minutes", () => {
    const started = new Date("2026-12-01T10:00:00Z");
    expect(isStale(started, new Date("2026-12-01T10:14:59Z"))).toBe(false);
    expect(isStale(started, new Date("2026-12-01T10:16:00Z"))).toBe(true);
  });
});
