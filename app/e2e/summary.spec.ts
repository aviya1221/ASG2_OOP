import { expect, test } from "@playwright/test";
import { ID, newCourse, openAs, secret, studentFor } from "./helpers.ts";

test.describe.configure({ timeout: 120_000 });

const RECORDING = { name: "lesson.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(4096) };

test("TC-080 the summary page opens only after the lesson and an upload", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 76);
  const [now, ended] = await newCourse([student], [{ number: 1 }, { number: 2, hoursFromNow: -3 }]);

  await openAs(page, student, `/lessons/${now}/forum`);
  await page.getByRole("link", { name: "סיכום השיעור" }).click();
  await expect(page.getByText("אין עדיין סיכום לשיעור הזה.")).toBeVisible();

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${now}/summary`);
  await expect(teacher.getByText("אפשר להעלות הקלטה אחרי סוף השיעור.")).toBeVisible();

  await teacher.goto(`/lessons/${ended}/summary`);
  await teacher.getByLabel("הקלטת השיעור").setInputFiles(RECORDING);
  await teacher.getByRole("button", { name: "העלאה ויצירת סיכום" }).click();
  await expect(teacher.getByRole("heading", { name: "סיכום", exact: true })).toBeVisible();
  await context.close();

  await page.goto(`/lessons/${ended}/summary`);
  await expect(page.getByRole("article", { name: "הסיכום" })).toBeVisible();
});

test("TC-085 the summary page shows the four parts", async ({ page }, info) => {
  const student = studentFor(info.project.name, 78);
  const [ended] = await newCourse([student], [{ number: 1, hoursFromNow: -3 }]);
  await secret.from("lesson_summaries").insert({
    lesson_id: ended,
    status: "ready",
    overview: "השיעור עסק בהסתברות מותנית ובדוגמאות.",
    topics: [{ title: "הגדרה", start: "00:30" }],
    questions: [{ time: "07:00", question: "מה ההבדל מחיתוך?", answer: "המכנה משתנה." }],
    board: [{ time: "03:00", content: "P(A|B) = P(A∩B) / P(B)" }],
  });

  await openAs(page, student, `/lessons/${ended}/summary`);
  const summary = page.getByRole("article", { name: "הסיכום" });
  for (const heading of ["סיכום", "נושאים", "שאלות ותשובות", "מהלוח"]) {
    await expect(summary.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(summary).toContainText("השיעור עסק בהסתברות מותנית ובדוגמאות.");
  await expect(summary).toContainText("הגדרה");
  await expect(summary).toContainText("המכנה משתנה.");
  await expect(summary).toContainText("P(A|B) = P(A∩B) / P(B)");
  await expect(page.getByRole("button", { name: "עריכת הסיכום" })).toHaveCount(0);
});

test("UC-04 the teacher edits the text of the summary", async ({ page }) => {
  const [ended] = await newCourse([], [{ number: 1, hoursFromNow: -3 }]);
  await secret.from("lesson_summaries").insert({ lesson_id: ended, status: "ready", overview: "טקסט עם טעות כתיב", topics: [], questions: [], board: [] });

  await openAs(page, ID.T1, `/lessons/${ended}/summary`);
  await page.getByRole("button", { name: "עריכת הסיכום" }).click();
  await page.getByLabel("סיכום", { exact: true }).fill("טקסט מתוקן");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("article", { name: "הסיכום" })).toContainText("טקסט מתוקן");
  const { data } = await secret.from("lesson_summaries").select("overview").eq("lesson_id", ended).single();
  expect(data?.overview).toBe("טקסט מתוקן");
});
