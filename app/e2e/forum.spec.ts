import { expect, test } from "@playwright/test";
import { ID, newCourse, newLesson, openAs, secret, signedInClient, studentFor } from "./helpers.ts";

// Several people sign in at once in these tests, which takes longer in the iPhone profile.
test.describe.configure({ timeout: 120_000 });

const POLL = [{ id: "q1", type: "single", text: "הבנתם את הדוגמה?", options: ["כן", "חלקית", "לא"] }];

async function publishPoll(lessonId: string): Promise<string> {
  const teacher = await signedInClient(ID.T1);
  const { data, error } = await teacher.from("surveys").insert({ lesson_id: lessonId, kind: "poll", questions: POLL }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

test("TC-041 the forums are listed by lecture number, with their titles", async ({ page }, info) => {
  const student = studentFor(info.project.name, 34);
  const [third] = await newCourse([student], [{ number: 3 }, { number: 1, topic: "מבוא" }, { number: 2 }]);

  await openAs(page, student, `/lessons/${third}/forum`);
  await page.getByRole("button", { name: "כל ההרצאות" }).click();
  const list = page.getByRole("navigation", { name: "כל הפורומים של הקורס" }).getByRole("link");
  await expect(list).toHaveText(["קורס בדיקה · הרצאה 1 · מבוא", "קורס בדיקה · הרצאה 2", "קורס בדיקה · הרצאה 3"]);
});

test("TC-044 a new message appears for others with no reload", async ({ browser, page }, info) => {
  const writer = studentFor(info.project.name, 36);
  const reader = studentFor(info.project.name, 38);
  const lessonId = await newLesson([writer, reader]);

  const others = await Promise.all([browser.newContext(), browser.newContext()]);
  const [readerPage, teacherPage] = await Promise.all(others.map((context) => context.newPage()));
  await openAs(readerPage, reader, `/lessons/${lessonId}/forum`);
  await openAs(teacherPage, ID.T1, `/lessons/${lessonId}/forum`);
  await openAs(page, writer, `/lessons/${lessonId}/forum`);
  await expect(readerPage.getByText("אין עדיין הודעות.")).toBeVisible();

  await page.getByLabel("הודעה חדשה").fill("מישהו הבין את השקף האחרון?");
  await page.getByRole("button", { name: "שליחה" }).click();

  await expect(readerPage.getByText("מישהו הבין את השקף האחרון?")).toBeVisible({ timeout: 2_000 });
  await expect(teacherPage.getByText("מישהו הבין את השקף האחרון?")).toBeVisible({ timeout: 2_000 });
  await Promise.all(others.map((context) => context.close()));
});

test("TC-045 a reply appears under its message", async ({ page }, info) => {
  const student = studentFor(info.project.name, 40);
  const lessonId = await newLesson([student]);
  const client = await signedInClient(student);
  await client.rpc("post_message", { p_lesson: lessonId, p_text: "שאלה ראשונה", p_reply_to: null, p_show_name: true });

  await openAs(page, ID.T1, `/lessons/${lessonId}/forum`);
  const question = page.locator("article", { hasText: "שאלה ראשונה" });
  await question.getByRole("button", { name: "תגובה" }).click();
  await page.getByRole("textbox", { name: "תגובה" }).fill("התשובה בשקף 4");
  await page.getByRole("button", { name: "שליחה" }).click();

  const reply = page.locator("article.reply", { hasText: "התשובה בשקף 4" });
  await expect(reply).toBeVisible();
  await expect(reply).toContainText("מרצה");
});

test("TC-046 a hidden name: the class sees no name, and the teacher sees who wrote it", async ({ browser, page }, info) => {
  const writer = studentFor(info.project.name, 42);
  const reader = studentFor(info.project.name, 44);
  const lessonId = await newLesson([writer, reader]);

  await openAs(page, writer, `/lessons/${lessonId}/forum`);
  await page.getByLabel("הודעה חדשה").fill("שאלה בלי שם");
  await page.getByLabel("להסתיר את השם שלי מהכיתה").check();
  await page.getByRole("button", { name: "שליחה" }).click();
  await expect(page.locator("article", { hasText: "שאלה בלי שם" })).toContainText("שם מוסתר");

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${lessonId}/forum`);
  const { data } = await secret.from("people").select("name").eq("id_number", writer).single();
  await expect(teacher.locator("article", { hasText: "שאלה בלי שם" })).toContainText(`${data!.name} (השם מוסתר מהכיתה)`);
  await context.close();
});

test("TC-047 a message is shown as text, and only the address is a link", async ({ page }, info) => {
  const student = studentFor(info.project.name, 46);
  const lessonId = await newLesson([student]);
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs += 1;
    void dialog.dismiss();
  });

  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await page.getByLabel("הודעה חדשה").fill("<img src=x onerror=alert(1)> https://example.com");
  await page.getByRole("button", { name: "שליחה" }).click();

  const message = page.locator("article", { hasText: "<img src=x onerror=alert(1)>" });
  await expect(message).toBeVisible();
  await expect(message.getByRole("link")).toHaveAttribute("href", "https://example.com");
  await expect(message.locator("img")).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test("TC-049 the teacher deletes a message, and the open page of a student updates", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 48);
  const lessonId = await newLesson([student]);
  const client = await signedInClient(student);
  await client.rpc("post_message", { p_lesson: lessonId, p_text: "הודעה לא במקום", p_reply_to: null, p_show_name: true });

  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await expect(page.getByText("הודעה לא במקום")).toBeVisible();
  await expect(page.getByRole("button", { name: "מחיקת ההודעה" })).toHaveCount(0);

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${lessonId}/forum`);
  await teacher.locator("article", { hasText: "הודעה לא במקום" }).getByRole("button", { name: "מחיקת ההודעה" }).click();
  await context.close();

  await expect(page.getByText("ההודעה נמחקה על ידי המרצה.")).toBeVisible({ timeout: 2_000 });
  await expect(page.getByText("הודעה לא במקום")).toHaveCount(0);
});

test("TC-050 write in the expanded window, where a poll is one line", async ({ page }, info) => {
  const student = studentFor(info.project.name, 54);
  const lessonId = await newLesson([student]);
  await publishPoll(lessonId);

  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await page.getByRole("button", { name: "הרחבה" }).click();
  const window = page.getByRole("dialog", { name: "השיחה המורחבת" });
  await expect(window).toBeVisible();
  const box = await window.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);

  await expect(window.locator(".poll-line")).toContainText("סקר: הבנתם את הדוגמה?");
  await window.getByLabel("הודעה חדשה").fill("כתבתי מהחלון המורחב");
  await window.getByRole("button", { name: "שליחה" }).click();
  await expect(window.getByText("כתבתי מהחלון המורחב")).toBeVisible();
});

test("TC-051 a message with no network stays in the box, and is saved once", async ({ context, page }, info) => {
  const student = studentFor(info.project.name, 52);
  const lessonId = await newLesson([student]);
  await openAs(page, student, `/lessons/${lessonId}/forum`);
  await expect(page.getByText("אין עדיין הודעות.")).toBeVisible();

  await context.setOffline(true);
  await page.getByLabel("הודעה חדשה").fill("נשלח בלי רשת");
  await page.getByRole("button", { name: "שליחה" }).click();
  await expect(page.getByRole("alert")).toHaveText("ההודעה לא נשלחה. אפשר לנסות שוב.");
  await expect(page.getByLabel("הודעה חדשה")).toHaveValue("נשלח בלי רשת");

  await context.setOffline(false);
  await page.getByRole("button", { name: "שליחה" }).click();
  await expect(page.locator("article", { hasText: "נשלח בלי רשת" })).toBeVisible();
  const { count } = await secret.from("forum_messages").select("*", { count: "exact", head: true }).eq("lesson_id", lessonId);
  expect(count).toBe(1);
});
