import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { ID, newCourse, newLesson, openAs, secret, SERVER_URL, signedInClient, studentFor } from "./helpers.ts";

test.describe.configure({ timeout: 120_000 });

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 ${name}, made up for the browser tests`) });

/** Publishes through the server, as the teacher, with the fake AI service of the test run. */
async function publish(lessonId: string, title: string): Promise<string> {
  const client = await signedInClient(ID.T1);
  const token = (await client.auth.getSession()).data.session!.access_token;
  const form = new FormData();
  form.append("lessonId", lessonId);
  form.append("title", title);
  form.append("file", new Blob([pdf("homework.pdf").buffer], { type: "application/pdf" }), "homework.pdf");
  const response = await fetch(`${SERVER_URL}/homework`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  expect(response.status).toBe(201);
  return ((await response.json()) as { homeworkId: string }).homeworkId;
}

/** A homework row with no file, for tests that put checks straight into the database. */
async function homeworkRow(lessonId: string): Promise<string> {
  const { data, error } = await secret.from("homework").insert({ lesson_id: lessonId, title: "מטלה 2", file_path: `${lessonId}/${randomUUID()}.pdf` }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

const SECTION_IDS = [
  { id: "q1_a", question: 1, section: 1 },
  { id: "q1_b", question: 1, section: 2 },
  { id: "q2_a", question: 2, section: 1 },
];

/** A saved check whose sections got these scores, with feedback that names the section. */
async function checkRow(homeworkId: string, studentId: string, overall: number, scores: [number, number, number]): Promise<void> {
  const sections = SECTION_IDS.map((place, i) => ({ ...place, score: scores[i]! }));
  const { error } = await secret.from("homework_checks").insert({
    homework_id: homeworkId,
    student_id: studentId,
    check_number: 1,
    overall,
    section_scores: sections,
    question_scores: [
      { id: "q1", question: 1, score: (scores[0] + scores[1]) / 2 },
      { id: "q2", question: 2, score: scores[2] },
    ],
    report: {
      sections: sections.map((section) => ({ ...section, answered: true, meets: `עומד ${section.id}`, missing: `חסר ${section.id}`, direction: `כיוון ${section.id}` })),
    },
  });
  if (error) throw new Error(error.message);
}

async function nameOf(idNumber: string): Promise<string> {
  const { data } = await secret.from("people").select("name").eq("id", idNumber).single();
  return data!.name as string;
}

async function checkSolution(page: Page): Promise<void> {
  await page.getByLabel("פתרון לבדיקה (PDF)").setInputFiles(pdf("solution.pdf"));
  await page.getByRole("button", { name: "בדיקת הפתרון" }).click();
}

test("TC-130 the teacher publishes a homework PDF, its student opens it, and a student of another course cannot", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 80);
  const lessonId = await newLesson([student]);

  await openAs(page, ID.T1, `/lessons/${lessonId}/homework`);
  await page.getByLabel("שם המטלה").fill("מטלה 1 בהסתברות");
  await page.getByLabel("קובץ המטלה (PDF)").setInputFiles(pdf("homework.pdf"));
  await page.getByRole("button", { name: "פרסום המטלה" }).click();
  await expect(page.getByRole("region", { name: "מטלה 1 בהסתברות" })).toBeVisible();

  const context = await browser.newContext();
  const studentPage = await context.newPage();
  await openAs(studentPage, student, `/lessons/${lessonId}/homework`);
  const link = studentPage.getByRole("region", { name: "מטלה 1 בהסתברות" }).getByRole("link", { name: "פתיחת המטלה" });
  const file = await studentPage.request.get((await link.getAttribute("href"))!);
  expect(file.status()).toBe(200);
  expect((await file.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await context.close();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await openAs(otherPage, ID.S51, `/lessons/${lessonId}/homework`);
  await expect(otherPage.getByText("השיעור הזה לא נמצא.")).toBeVisible();
  await other.close();
});

test("TC-144 a homework published in one lesson shows in every lesson of the course, with the lecture it came from", async ({ page }, info) => {
  const student = studentFor(info.project.name, 90);
  const [first, second] = await newCourse([student], [{ number: 1 }, { number: 2, hoursFromNow: 24 }]);
  await publish(first!, "מטלה מההרצאה הראשונה");

  await openAs(page, student, `/lessons/${second}/homework`);
  const item = page.getByRole("region", { name: "מטלה מההרצאה הראשונה" });
  await expect(item).toBeVisible();
  await expect(item.getByText(/פורסמה בהרצאה 1 · /)).toBeVisible();
});

test("TC-132 the student checks a solution from the button next to the homework, and the report opens on the same page", async ({ page }, info) => {
  const student = studentFor(info.project.name, 82);
  const lessonId = await newLesson([student]);
  await publish(lessonId, "מטלה לבדיקה");

  await openAs(page, student, `/lessons/${lessonId}/homework`);
  const homework = page.getByRole("region", { name: "מטלה לבדיקה" });
  await expect(homework.getByText("נשארו 3 בדיקות מתוך 3.", { exact: false })).toBeVisible();
  await checkSolution(page);

  await expect(homework.getByRole("region", { name: "הדוח שלך" })).toContainText("הדוח שלך: בדיקה 1 מתוך 3");
  await expect(homework.getByText("נשארו 2 בדיקות מתוך 3.", { exact: false })).toBeVisible();
  expect(page.url()).toContain(`/lessons/${lessonId}/homework`);
});

test("TC-134 a section that was not answered gets 0, with a notice at the top of the report", async ({ page }, info) => {
  const student = studentFor(info.project.name, 84);
  const lessonId = await newLesson([student]);
  await publish(lessonId, "מטלה ריקה");

  // The fake AI service of the test run marks every section as not answered.
  await openAs(page, student, `/lessons/${lessonId}/homework`);
  await checkSolution(page);
  const report = page.getByRole("region", { name: "הדוח שלך" });
  await expect(report.getByRole("note")).toContainText("סעיפים שלא נענו וקיבלו 0");
  await expect(report).toContainText("לא נענה: 0");
  await expect(report).toContainText("ציון כולל: 1");
});

test("TC-133 the student sees the score and the three parts of the feedback of each section, and a classmate does not", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 86);
  const classmate = studentFor(info.project.name, 88);
  const lessonId = await newLesson([student, classmate]);
  const homeworkId = await homeworkRow(lessonId);
  await checkRow(homeworkId, student, 72, [80, 60, 75]);

  await openAs(page, student, `/lessons/${lessonId}/homework`);
  const section = page.getByRole("region", { name: "הדוח שלך" }).getByRole("article", { name: "שאלה 1, סעיף א" });
  await expect(section).toContainText("80 מתוך 100");
  for (const text of ["מה עומד בדרישות", "עומד q1_a", "מה חסר", "חסר q1_a", "כיוון לשיפור", "כיוון q1_a"]) await expect(section).toContainText(text);

  const context = await browser.newContext();
  const other = await context.newPage();
  await openAs(other, classmate, `/lessons/${lessonId}/homework`);
  await expect(other.getByRole("region", { name: "מטלה 2" })).toBeVisible();
  await expect(other.getByRole("region", { name: "הדוח שלך" })).toHaveCount(0);
  await expect(other.getByText("חסר q1_a")).toHaveCount(0);
  await context.close();
});

test("TC-137 the class chart gives equal scores one place, marks the viewer, and the filter changes the order", async ({ page }, info) => {
  const [first, second, viewer] = [90, 92, 94].map((base) => studentFor(info.project.name, base)) as [string, string, string];
  const lessonId = await newLesson([first, second, viewer]);
  const homeworkId = await homeworkRow(lessonId);
  await checkRow(homeworkId, first, 80, [90, 70, 80]);
  await checkRow(homeworkId, second, 80, [100, 100, 60]);
  await checkRow(homeworkId, viewer, 60, [40, 40, 100]);
  const viewerName = await nameOf(viewer);

  await openAs(page, viewer, `/lessons/${lessonId}/homework`);
  const chart = page.getByRole("region", { name: "גרף הכיתה" });
  const rows = chart.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("1.");
  await expect(rows.nth(1)).toContainText("1.");
  await expect(rows.nth(2)).toContainText(`3. ${viewerName} (המקום שלך)`);
  await expect(rows.nth(2)).toHaveAttribute("aria-current", "true");

  await chart.getByLabel("לפי").selectOption({ label: "שאלה 2" });
  await expect(rows.nth(0)).toContainText(`1. ${viewerName} (המקום שלך)`);
});

test("TC-142 the teacher deletes a homework after confirming, and a cancel keeps it", async ({ page }) => {
  const lessonId = await newLesson();
  await publish(lessonId, "מטלה למחיקה");
  await openAs(page, ID.T1, `/lessons/${lessonId}/homework`);
  const card = page.getByRole("region", { name: "מטלה למחיקה" });

  page.once("dialog", (dialog) => void dialog.dismiss());
  await card.getByRole("button", { name: "מחיקת המטלה מטלה למחיקה" }).click();
  await expect(card).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await card.getByRole("button", { name: "מחיקת המטלה מטלה למחיקה" }).click();
  await expect(card).toHaveCount(0);
  expect((await secret.from("homework").select("id").eq("lesson_id", lessonId)).data).toEqual([]);
});

test("TC-119 publishing goes on while the teacher moves to another tab, and its result is there on return", async ({ page }) => {
  const lessonId = await newLesson();
  await openAs(page, ID.T1, `/lessons/${lessonId}/homework`);
  await page.getByLabel("שם המטלה").fill("מטלה ברקע");
  await page.getByLabel("קובץ המטלה (PDF)").setInputFiles(pdf("homework.pdf"));
  // The fake AI service answers at once, so the request waits a little to leave time to move to another tab.
  await page.route(`${SERVER_URL}/homework`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.continue();
  });
  await page.getByRole("button", { name: "פרסום המטלה" }).click();
  await expect(page.getByRole("status").getByText(/מכין את הנחיות הבדיקה מהמטלה/)).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "לשוניות השיעור" });
  await tabs.getByRole("link", { name: "נוכחות" }).click();
  await expect(page.getByText('המטלה "מטלה ברקע" פורסמה.')).toBeVisible();
  await tabs.getByRole("link", { name: "מטלות" }).click();
  await expect(page.getByRole("region", { name: "מטלה ברקע" })).toBeVisible();
});
