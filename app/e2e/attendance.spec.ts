import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { classPhoto, confirmAs, endConfirming, ID, keepClassPhotoOnPhone, newLesson, openAs, photograph, recordPosts, secret, signedInClient, studentFor } from "./helpers.ts";

const MODELS_TIMEOUT = 150_000;

/** Three made-up faces, as the face finder places them in the class photo of the helpers. */
const THREE_FACES = [
  [100, 75, 300, 350],
  [600, 75, 300, 350],
  [1100, 75, 300, 350],
];

async function namesOf(students: string[]): Promise<Record<string, string>> {
  const { data } = await secret.from("people").select("id, name").in("id", students);
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.name]));
}

const rowOf = (page: Page, student: string) => page.locator(`tr[data-student="${student}"]`);

test("TC-014 photograph the class, and only the number of faces leaves the phone", async ({ page }) => {
  test.setTimeout(MODELS_TIMEOUT + 30_000);
  const lessonId = await newLesson();
  const posts = recordPosts(page);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  await page.getByLabel("צילום הכיתה").setInputFiles(await classPhoto(page));
  await expect(page.getByText("בתמונה נמצאו 3 פנים", { exact: false })).toBeVisible({ timeout: MODELS_TIMEOUT });
  await page.getByRole("button", { name: "שליחה ופתיחת האישורים" }).click();
  await expect(page.getByRole("heading", { name: /נשארו [34]:\d\d דקות לאישור נוכחות/ })).toBeVisible();

  const sent = posts.find((post) => post.url.endsWith("/attendance/class"));
  expect(JSON.parse(sent!.body)).toEqual({ lessonId, faceCount: 3 });
  for (const post of posts) expect(post.body).not.toContain("data:image");
});

test("TC-017 a student confirms within the 4 minutes, and is present when no more confirmed than the faces", async ({ page }, info) => {
  const student = studentFor(info.project.name, 16);
  const lessonId = await newLesson([student]);

  await openAs(page, student, `/lessons/${lessonId}/attendance`);
  await expect(page.getByText("המרצה עוד לא צילם את הכיתה.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "הייתי בשיעור" })).toHaveCount(0);

  await photograph(lessonId, 3);
  await page.reload();
  await expect(page.getByText(/נשארו [34]:\d\d דקות לאישור/)).toBeVisible();
  await page.getByRole("button", { name: "הייתי בשיעור" }).click();
  await expect(page.getByText("אישרת שהיית בשיעור.")).toBeVisible();

  await endConfirming(lessonId);
  await page.reload();
  await expect(page.getByText("התוצאה שלך:")).toContainText("נוכח");
  await expect(page.getByRole("button", { name: "הייתי בשיעור" })).toHaveCount(0);
});

test("UC-01 a student who did not confirm in time is not present", async ({ page }, info) => {
  const student = studentFor(info.project.name, 12);
  const lessonId = await newLesson([student]);
  await photograph(lessonId, 3);
  await endConfirming(lessonId);

  await openAs(page, student, `/lessons/${lessonId}/attendance`);
  await expect(page.getByText("התוצאה שלך:")).toContainText("לא נוכח");
  await expect(page.getByText("לא אישרת שהיית בשיעור בזמן.")).toBeVisible();
  await expect(page.getByRole("button", { name: "הייתי בשיעור" })).toHaveCount(0);
});

test("TC-027 the sheet updates with each confirmation", async ({ page }, info) => {
  const first = studentFor(info.project.name, 18);
  const second = studentFor(info.project.name, 20);
  const lessonId = await newLesson([first, second]);
  await photograph(lessonId, 2);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  const resultOf = (student: string) => rowOf(page, student).locator(".chip");
  await expect(resultOf(first)).toHaveText("עוד לא אישר");
  await page.waitForTimeout(1_000);

  await confirmAs(first, lessonId);
  await expect(resultOf(first)).toHaveText("אישר", { timeout: 3_000 });
  await confirmAs(second, lessonId);
  await expect(resultOf(second)).toHaveText("אישר", { timeout: 3_000 });
  await expect(page.getByText("עד עכשיו 2 סטודנטים אישרו. בתמונה נמצאו 2 פרצופים.")).toBeVisible();
});

test("more students confirmed than the faces: each picks a number, and the teacher decides two picks of one number", async ({ browser, page }, info) => {
  // A teacher and four students, two of them in browsers, take longer than one page.
  test.setTimeout(90_000);
  const [first, second, third, fourth] = [22, 24, 26, 28].map((base) => studentFor(info.project.name, base)) as [string, string, string, string];
  const lessonId = await newLesson([first, second, third, fourth]);
  await photograph(lessonId, 3);
  for (const student of [first, second, third, fourth]) await confirmAs(student, lessonId);
  await endConfirming(lessonId);
  const names = await namesOf([first, second, fourth]);

  // The teacher's phone still has the photo, with its three face boxes.
  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, "/");
  await keepClassPhotoOnPhone(teacher, lessonId, await classPhoto(teacher), THREE_FACES);
  await teacher.goto(`/lessons/${lessonId}/attendance`);
  await expect(teacher.getByText("4 סטודנטים אישרו, אבל בתמונה נמצאו רק 3 פרצופים.", { exact: false })).toBeVisible();
  await expect(teacher.getByRole("img", { name: "תמונת הכיתה עם מספרים" })).toBeVisible();
  await teacher.getByRole("button", { name: "שיתוף התמונה עם מספרים" }).click();
  await expect(teacher.getByText("התמונה שותפה עם הסטודנטים שאישרו.", { exact: false })).toBeVisible({ timeout: 15_000 });
  const { data: numbers } = await secret.from("photo_numbers").select("number, face_no").eq("lesson_id", lessonId).order("number");
  expect(numbers).toEqual([
    { number: 1, face_no: 0 },
    { number: 2, face_no: 1 },
    { number: 3, face_no: 2 },
  ]);

  await openAs(page, first, `/lessons/${lessonId}/attendance`);
  await expect(page.getByRole("img", { name: "תמונת הכיתה 1 עם מספרים" })).toBeVisible();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "אני מספר 1" }).click();
  await expect(page.getByText("בחרת את מספר 1: נקלט")).toBeVisible();

  // A second student picks the same number, a third picks another, and a fourth is not in the photo.
  const pick = async (student: string, number: number | null) =>
    expect((await (await signedInClient(student)).from("number_claims").insert({ lesson_id: lessonId, student_id: student, number })).error).toBeNull();
  await pick(second, 1);
  await pick(third, 2);
  await pick(fourth, null);
  await page.reload();
  await expect(page.getByText("בחרת את מספר 1: הועבר למרצה להמשך טיפול")).toBeVisible();

  await expect(teacher.getByText("2 סטודנטים בחרו את מספר 1").first()).toBeVisible();
  await expect(teacher.getByText(`${names[fourth]}: לא מופיע בתמונה`)).toBeVisible();
  await teacher.getByRole("button", { name: `אישור הבחירה של ${names[first]}` }).click();
  await expect(rowOf(teacher, first)).toContainText("נוכח");
  await expect(teacher.getByRole("button", { name: `אישור הבחירה של ${names[second]}` })).toHaveCount(0);
  await expect(rowOf(teacher, second)).toContainText("לא נוכח");
  await expect(rowOf(teacher, second)).toContainText("מסומן");
  await expect(rowOf(teacher, third)).toContainText("נוכח");
  await expect(rowOf(teacher, fourth)).toContainText("ממתין");
  await context.close();

  await page.reload();
  await expect(page.getByText("בחרת את מספר 1: אושר")).toBeVisible();
  const { data: claims } = await secret.from("number_claims").select("student_id, status").eq("lesson_id", lessonId).in("student_id", [first, second]).order("student_id");
  expect(claims).toEqual([
    { student_id: first, status: "approved" },
    { student_id: second, status: "rejected" },
  ]);
});

test("the photo can be shared only from the phone that took it", async ({ page }, info) => {
  const [first, second] = [32, 34].map((base) => studentFor(info.project.name, base)) as [string, string];
  const lessonId = await newLesson([first, second]);
  await photograph(lessonId, 1);
  await confirmAs(first, lessonId);
  await confirmAs(second, lessonId);
  await endConfirming(lessonId);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  await expect(page.getByText("את תמונת הכיתה עם המספרים אפשר לשתף רק מהמכשיר שצילם אותה.")).toBeVisible();

  const context = await page.context().browser()!.newContext();
  const studentPage = await context.newPage();
  await openAs(studentPage, first, `/lessons/${lessonId}/attendance`);
  await expect(studentPage.getByText("היו יותר אישורים מאנשים בתמונה. המרצה ישתף את תמונת הכיתה", { exact: false })).toBeVisible();
  await expect(studentPage.getByText("התוצאה שלך:")).toContainText("ממתין");
  await context.close();
});

test("the teacher changes a student's attendance, also with no photo, and goes back to the automatic result", async ({ page }, info) => {
  const student = studentFor(info.project.name, 36);
  const lessonId = await newLesson([student]);
  const name = (await namesOf([student]))[student]!;

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  await expect(rowOf(page, student)).toContainText("לא צולם");
  const change = page.getByLabel(`שינוי הנוכחות של ${name}`);

  await change.selectOption("present");
  await expect(rowOf(page, student)).toContainText("נוכח");
  await expect.poll(async () => (await secret.from("attendance_overrides").select("present").eq("lesson_id", lessonId).eq("student_id", student).maybeSingle()).data?.present).toBe(true);

  await change.selectOption("absent");
  await expect(rowOf(page, student)).toContainText("לא נוכח");

  await change.selectOption("auto");
  await expect(rowOf(page, student)).toContainText("לא צולם");
  await expect.poll(async () => (await secret.from("attendance_overrides").select("present").eq("lesson_id", lessonId).eq("student_id", student).maybeSingle()).data).toBeNull();
});

test("TC-028 download the sheet", async ({ page }, info) => {
  // A name that looks like a formula must reach the file as plain text.
  const formulaId = `formula-${info.project.name}`;
  const email = `${formulaId}@users.lesson.invalid`;
  await secret.from("people").upsert({ id: formulaId, email, name: "=1+1", role: "student" });
  const lessonId = await newLesson([formulaId]);
  await photograph(lessonId, 1);
  await secret.from("attendance_confirmations").insert({ lesson_id: lessonId, student_id: formulaId });
  await endConfirming(lessonId);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  await expect(rowOf(page, formulaId)).toContainText("נוכח");
  await expect(rowOf(page, formulaId)).toContainText(email);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "הורדת הגיליון" }).click()]);
  const reader = fileURLToPath(new URL("./read-sheet.mjs", import.meta.url));
  const file = JSON.parse(execFileSync(process.execPath, [reader, await download.path()], { encoding: "utf8" })) as {
    rightToLeft: boolean;
    rows: unknown[][];
    formulas: number;
  };

  expect(file.rightToLeft).toBe(true);
  expect(file.formulas).toBe(0);
  expect(file.rows[0]).toEqual(["אימייל", "שם", "נוכחות", "איך הוחלט", "הערה"]);
  const row = file.rows.find((candidate) => candidate[0] === email);
  expect(row?.slice(0, 4)).toEqual([email, "=1+1", "נוכח", "אישור עצמי"]);
});
