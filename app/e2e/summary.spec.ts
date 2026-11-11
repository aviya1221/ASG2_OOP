import { expect, test } from "@playwright/test";
import { ID, newCourse, openAs, secret, studentFor } from "./helpers.ts";

test.describe.configure({ timeout: 120_000 });

const RECORDING = { name: "lesson.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(4096) };

const BODY = `# הסתברות מותנית

השיעור עסק בהסתברות מותנית ובדוגמאות.

## הגדרה

- **הסתברות מותנית**: \`P(A|B) = P(A∩B) / P(B)\`

## שאלות מהשיעור

- **מה ההבדל מחיתוך?** המכנה משתנה.`;

test("TC-080 the summary page opens only after the lesson, an upload and publishing", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 76);
  const [now, ended] = await newCourse([student], [{ number: 1 }, { number: 2, hoursFromNow: -3 }]);

  await openAs(page, student, `/lessons/${now}/forum`);
  await page.getByRole("link", { name: "סיכום השיעור" }).click();
  await expect(page.getByText("אין עדיין סיכום לשיעור הזה.", { exact: false })).toBeVisible();

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${now}/summary`);
  await expect(teacher.getByText("אפשר להעלות הקלטה אחרי סוף השיעור.")).toBeVisible();

  await teacher.goto(`/lessons/${ended}/summary`);
  await teacher.getByLabel("הקלטת השיעור").setInputFiles(RECORDING);
  await teacher.getByRole("button", { name: "העלאה ויצירת סיכום" }).click();
  await expect(teacher.getByRole("article", { name: "הסיכום" })).toBeVisible();
  await expect(teacher.getByText("גלוי רק לך", { exact: true })).toBeVisible();

  await page.goto(`/lessons/${ended}/summary`);
  await expect(page.getByText("הוא יופיע כאן אחרי שהמרצה יפרסם אותו", { exact: false })).toBeVisible();
  await expect(page.getByRole("article", { name: "הסיכום" })).toHaveCount(0);

  await teacher.getByRole("button", { name: "פרסום לכיתה" }).click();
  await expect(teacher.getByText("פורסם לכיתה", { exact: true })).toBeVisible();
  await context.close();
  await page.reload();
  await expect(page.getByRole("article", { name: "הסיכום" })).toBeVisible();
});

test("TC-143 the teacher publishes the summary to the class and hides it again", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 74);
  const [ended] = await newCourse([student], [{ number: 1, hoursFromNow: -3 }]);
  await secret.from("lesson_summaries").insert({ lesson_id: ended, status: "ready", body: BODY });

  await openAs(page, ID.T1, `/lessons/${ended}/summary`);
  await expect(page.getByText("גלוי רק לך", { exact: true })).toBeVisible();

  const context = await browser.newContext();
  const studentPage = await context.newPage();
  await openAs(studentPage, student, `/lessons/${ended}/summary`);
  await expect(studentPage.getByRole("article", { name: "הסיכום" })).toHaveCount(0);

  await page.getByRole("button", { name: "פרסום לכיתה" }).click();
  await studentPage.reload();
  await expect(studentPage.getByRole("article", { name: "הסיכום" })).toBeVisible();

  await page.getByRole("button", { name: "הסתרה מהכיתה" }).click();
  await expect(page.getByText("גלוי רק לך", { exact: true })).toBeVisible();
  await studentPage.reload();
  await expect(studentPage.getByRole("article", { name: "הסיכום" })).toHaveCount(0);
  await context.close();
});

test("TC-085 the summary is one page with headings, bold terms, the board inside its topic and the questions", async ({ page }, info) => {
  const student = studentFor(info.project.name, 78);
  const [ended] = await newCourse([student], [{ number: 1, hoursFromNow: -3 }]);
  await secret.from("lesson_summaries").insert({ lesson_id: ended, status: "ready", body: BODY, published: true });

  await openAs(page, student, `/lessons/${ended}/summary`);
  const summary = page.getByRole("article", { name: "הסיכום" });
  await expect(summary.getByRole("heading", { level: 1, name: "הסתברות מותנית" })).toBeVisible();
  for (const heading of ["הגדרה", "שאלות מהשיעור"]) {
    await expect(summary.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
  await expect(summary.locator("strong", { hasText: "הסתברות מותנית" })).toBeVisible();
  await expect(summary.locator("code")).toHaveText("P(A|B) = P(A∩B) / P(B)");
  await expect(summary).toContainText("המכנה משתנה.");
  await expect(page.getByRole("button", { name: "עריכת הסיכום" })).toHaveCount(0);
});

test("UC-04 the teacher edits the text of the summary", async ({ page }) => {
  const [ended] = await newCourse([], [{ number: 1, hoursFromNow: -3 }]);
  await secret.from("lesson_summaries").insert({ lesson_id: ended, status: "ready", body: "# טקסט עם טעות כתיב" });

  await openAs(page, ID.T1, `/lessons/${ended}/summary`);
  await page.getByRole("button", { name: "עריכת הסיכום" }).click();
  await page.getByLabel("הסיכום", { exact: true }).fill("# טקסט מתוקן");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("article", { name: "הסיכום" }).getByRole("heading", { level: 1 })).toHaveText("טקסט מתוקן");
  const { data } = await secret.from("lesson_summaries").select("body").eq("lesson_id", ended).single();
  expect(data?.body).toBe("# טקסט מתוקן");
});
