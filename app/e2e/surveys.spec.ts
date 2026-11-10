import { expect, test } from "@playwright/test";
import { ID, L1, newCourse, newLesson, openAs, secret, signedInClient, studentFor } from "./helpers.ts";

// Several people sign in at once in these tests, which takes longer in the iPhone profile.
test.describe.configure({ timeout: 120_000 });

test("TC-061 a poll appears for the students of the lesson with no reload", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 60);
  const lessonId = await newLesson([student]);

  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await expect(page.getByText("אין עדיין הודעות.")).toBeVisible();

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${lessonId}/forum`);
  await teacher.getByRole("button", { name: "סקר חדש" }).click();
  await teacher.getByLabel("שאלת הסקר").fill("מה הקושי העיקרי?");
  await teacher.getByLabel("אפשרות 1").fill("ההגדרות");
  await teacher.getByLabel("אפשרות 2").fill("הדוגמאות");
  await teacher.getByRole("button", { name: "פרסום הסקר" }).click();
  await context.close();

  await expect(page.getByRole("article", { name: "סקר: מה הקושי העיקרי?" })).toBeVisible({ timeout: 2_000 });

  const outsider = await browser.newContext();
  const other = await outsider.newPage();
  await openAs(other, ID.S51, `/lessons/${lessonId}/forum`);
  await expect(other.getByText("השיעור הזה לא נמצא.")).toBeVisible();
  await outsider.close();
});

test("TC-065 the chart updates for everyone", async ({ browser, page }, info) => {
  const watcher = studentFor(info.project.name, 62);
  const voters = [64, 66, 68].map((n) => studentFor(info.project.name, n));
  const lessonId = await newLesson([watcher, ...voters]);
  const teacherClient = await signedInClient(ID.T1);
  const { data: poll } = await teacherClient
    .from("surveys")
    .insert({ lesson_id: lessonId, kind: "poll", questions: [{ id: "q1", type: "single", text: "איך היה?", options: ["טוב", "קשה"] }] })
    .select("id")
    .single();

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${lessonId}/forum`);
  await openAs(page, watcher, `/lessons/${lessonId}/forum`);
  await expect(page.getByRole("article", { name: "סקר: איך היה?" })).toBeVisible();

  for (const voter of voters) {
    const client = await signedInClient(voter);
    await client.from("answers").insert({ survey_id: poll!.id, student_id: voter, value: { q1: 0 } });
  }

  for (const screen of [page, teacher]) {
    await expect(screen.locator('[data-survey] .result-row[data-option="0"] .count')).toHaveText("3", { timeout: 2_000 });
  }
  await context.close();
});

test("TC-069 a closed poll and a closed form stay in the forum", async ({ page }, info) => {
  const student = studentFor(info.project.name, 70);
  const lessonId = await newLesson([student]);
  const teacher = await signedInClient(ID.T1);
  const { data: poll } = await teacher
    .from("surveys")
    .insert({ lesson_id: lessonId, kind: "poll", questions: [{ id: "q1", type: "single", text: "סקר שנסגר", options: ["א", "ב"] }] })
    .select("id")
    .single();
  const { data: form } = await teacher
    .from("surveys")
    .insert({ lesson_id: lessonId, kind: "form", questions: [{ id: "q1", type: "text", text: "מה למדנו?" }] })
    .select("id")
    .single();
  const client = await signedInClient(student);
  await client.from("answers").insert({ survey_id: poll!.id, student_id: student, value: { q1: 1 } });
  await teacher.from("surveys").update({ status: "closed" }).in("id", [poll!.id, form!.id]);

  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await page.reload();
  const pollCard = page.getByRole("article", { name: "סקר: סקר שנסגר" });
  await expect(pollCard).toContainText("הסקר סגור");
  await expect(pollCard.locator('.result-row[data-option="1"] .count')).toHaveText("1");
  await expect(page.locator(`[data-survey="${form!.id}"]`)).toContainText("הטופס סגור");
});

test("TC-070 build a form before the lesson, keep it as a draft, then publish it @computer", async ({ browser, page }) => {
  const student = "300000049";
  const [future] = await newCourse([student], [{ number: 1, hoursFromNow: 48 }]);

  await openAs(page, ID.T1, `/lessons/${future}/forum`);
  await page.getByRole("button", { name: "טופס חדש" }).click();
  const builder = page.getByRole("dialog", { name: "טופס חדש" });
  for (const type of ["+ בחירה יחידה", "+ בחירה מרובה", "+ דירוג בסולם", "+ טקסט חופשי"]) {
    await builder.getByRole("button", { name: type }).click();
  }
  for (const [index, text] of ["איזה פרק?", "מה עזר?", "כמה ברור?", "הערות"].entries()) {
    await builder.getByLabel(`נוסח שאלה ${index + 1}`).fill(text);
  }
  for (const question of [1, 2]) {
    await builder.getByLabel(`שאלה ${question} אפשרות 1`).fill("ראשון");
    await builder.getByLabel(`שאלה ${question} אפשרות 2`).fill("שני");
  }
  await builder.getByRole("button", { name: "שמירה כטיוטה" }).click();
  await expect(page.getByRole("heading", { name: "טיוטות" })).toBeVisible();

  const context = await browser.newContext();
  const studentPage = await context.newPage();
  await openAs(studentPage, student, `/lessons/${future}/forum`);
  await expect(studentPage.getByRole("article", { name: "טופס" })).toHaveCount(0);

  await page.getByRole("button", { name: "פרסום", exact: true }).click();
  await expect(studentPage.getByRole("article", { name: "טופס" })).toContainText("4 שאלות");
  await context.close();
});

test("TC-072 a student answers a form in a window over the forum", async ({ page }, info) => {
  const student = studentFor(info.project.name, 72);
  const lessonId = await newLesson([student]);
  const teacher = await signedInClient(ID.T1);
  const { data: form } = await teacher
    .from("surveys")
    .insert({
      lesson_id: lessonId,
      kind: "form",
      questions: [
        { id: "q1", type: "single", text: "איזה פרק?", options: ["ראשון", "שני"] },
        { id: "q2", type: "text", text: "הערות" },
      ],
    })
    .select("id")
    .single();

  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await page.getByRole("button", { name: "מילוי הטופס" }).click();
  const window = page.getByRole("dialog", { name: "טופס" });
  await expect(window).toBeVisible();
  await expect(page.getByRole("heading", { name: "פורום" })).toBeAttached();

  await window.getByLabel("שני").check();
  await window.getByRole("button", { name: "שליחת התשובות" }).click();
  await expect(window.locator('[data-question="q2"]')).toContainText("צריך לענות על השאלה הזאת.");
  expect((await secret.from("answers").select("*").eq("survey_id", form!.id)).data).toEqual([]);

  await window.getByLabel("הערות").fill("היה ברור");
  await window.getByRole("button", { name: "שליחת התשובות" }).click();
  await expect(window).toHaveCount(0);
  await expect(page.getByText("התשובות שלך נשלחו.")).toBeVisible();
  const { data } = await secret.from("answers").select("value").eq("survey_id", form!.id).single();
  expect(data?.value).toEqual({ q1: 1, q2: "היה ברור" });
});

test("UC-03 the teacher sees who answered a poll, and closes it", async ({ page }, info) => {
  const student = studentFor(info.project.name, 74);
  const lessonId = await newLesson([student]);
  const teacher = await signedInClient(ID.T1);
  const { data: poll } = await teacher
    .from("surveys")
    .insert({ lesson_id: lessonId, kind: "poll", questions: [{ id: "q1", type: "single", text: "מוכנים?", options: ["כן", "לא"] }] })
    .select("id")
    .single();
  const client = await signedInClient(student);
  await client.from("answers").insert({ survey_id: poll!.id, student_id: student, value: { q1: 1 } });
  const { data: person } = await secret.from("people").select("name").eq("id_number", student).single();

  await openAs(page, ID.T1, `/lessons/${lessonId}/forum`);
  const card = page.getByRole("article", { name: "סקר: מוכנים?" });
  await card.getByText("מי ענה").click();
  await expect(card).toContainText(`${person!.name}: לא`);
  await card.getByRole("button", { name: "סגירת הסקר" }).click();
  await expect(card).toContainText("הסקר סגור");
  expect(L1).toBeTruthy();
});
