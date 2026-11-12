import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  blankPhoto,
  classPhoto,
  clearFace,
  endHour,
  hashOf,
  ID,
  keepClassPhotoOnPhone,
  newLesson,
  openAs,
  PERSON_PHOTO,
  printFor,
  recordPosts,
  registerFace,
  respondAs,
  secret,
  signedInClient,
  startRound,
  storeFaceInBrowser,
  studentFor,
} from "./helpers.ts";

const MODELS_TIMEOUT = 150_000;

test("TC-010 register a face from one photo, and only a hash leaves the phone", async ({ page }, info) => {
  test.setTimeout(MODELS_TIMEOUT + 30_000);
  const student = studentFor(info.project.name, 10);
  await clearFace(student);
  const posts = recordPosts(page);

  await openAs(page, student, "/face");
  await page.getByLabel("צילום תמונה").setInputFiles(PERSON_PHOTO);
  await expect(page.getByText("הפנים נרשמו.")).toBeVisible({ timeout: MODELS_TIMEOUT });

  const registration = posts.find((post) => post.url.endsWith("/faces/register"));
  const sent = JSON.parse(registration!.body) as Record<string, string>;
  expect(Object.keys(sent)).toEqual(["hash"]);
  expect(sent.hash).toMatch(/^[0-9a-f]{64}$/);
  for (const post of posts) {
    expect(post.body.length).toBeLessThan(5_000);
    expect(post.body).not.toContain("data:image");
  }

  const { data } = await secret.from("face_registrations").select("hash").eq("student_id", student).single();
  expect(data?.hash).toBe(sent.hash);
  const stored = await page.evaluate((id) => localStorage.getItem(`face-print:${id}`), student);
  expect((JSON.parse(stored!) as { print: number[] }).print).toHaveLength(128);
});

test("TC-011 ask for another photo when no face is found", async ({ page }, info) => {
  test.setTimeout(MODELS_TIMEOUT + 30_000);
  const student = studentFor(info.project.name, 12);
  await clearFace(student);
  const posts = recordPosts(page);

  await openAs(page, student, "/face");
  await page.getByLabel("צילום תמונה").setInputFiles(await blankPhoto(page));
  await expect(page.getByRole("alert")).toHaveText("לא נמצאו פנים בתמונה. אפשר לצלם תמונה אחרת.", { timeout: MODELS_TIMEOUT });
  expect(posts.filter((post) => post.url.endsWith("/faces/register"))).toEqual([]);
});

test("TC-012 opt out of face recognition, and no response is sent", async ({ page }, info) => {
  const student = studentFor(info.project.name, 14);
  await clearFace(student);
  const lessonId = await newLesson([student]);
  await startRound(lessonId, [printFor(50)]);
  const posts = recordPosts(page);

  await openAs(page, student, "/face");
  await page.getByRole("button", { name: "לא להשתתף בזיהוי פנים" }).click();
  await expect(page.getByText("בחרת לא להשתתף בזיהוי פנים")).toBeVisible();

  const { data } = await secret.from("face_registrations").select("hash, opted_out").eq("student_id", student).single();
  expect(data).toEqual({ hash: null, opted_out: true });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "השיעורים שלי" })).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(posts.filter((post) => post.url.endsWith("/attendance/response"))).toEqual([]);
});

test("TC-014 send the class photos with no photo leaving the phone", async ({ page }) => {
  test.setTimeout(2 * MODELS_TIMEOUT);
  const lessonId = await newLesson();
  const posts = recordPosts(page);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  const photo = await classPhoto(page);

  for (const number of [1, 2, 3]) {
    await page.getByLabel("צילום הכיתה").setInputFiles(photo);
    await expect(page.getByText(`תמונה ${number}: נמצאו 3 פנים`)).toBeVisible({ timeout: MODELS_TIMEOUT });
  }
  await page.getByRole("button", { name: "סיום ושליחה" }).click();
  await expect(page.getByRole("heading", { name: "נשארו 60 דקות לאיסוף תגובות" })).toBeVisible();

  const sent = posts.find((post) => post.url.endsWith("/attendance/class"));
  expect(sent!.body).not.toContain("data:image");
  const body = JSON.parse(sent!.body) as { photos: { faces: Record<string, number[]>[] }[] };
  expect(body.photos).toHaveLength(3);
  for (const { faces } of body.photos) {
    for (const face of faces) {
      expect(Object.keys(face).sort()).toEqual(["box", "print"]);
      expect(face.print).toHaveLength(128);
    }
  }
});

test("TC-017 collect a response when the student opens the site", async ({ page }, info) => {
  const student = studentFor(info.project.name, 16);
  const print = printFor(16);
  await registerFace(student, print);
  await storeFaceInBrowser(page, student, print);
  const lessonId = await newLesson([student]);
  await startRound(lessonId, [print]);
  const posts = recordPosts(page);

  await openAs(page, student, "/");
  const responses = () => posts.filter((post) => post.url.endsWith("/attendance/response") && post.body.includes(lessonId));
  await expect.poll(() => responses().length).toBe(1);
  await expect.poll(async () => (await secret.from("attendance_results").select("result").eq("lesson_id", lessonId).eq("student_id", student).maybeSingle()).data?.result).toBe("present");

  await page.goto(`/lessons/${lessonId}/attendance`);
  await expect(page.getByText("נוכח", { exact: true })).toBeVisible();
  expect(responses()).toHaveLength(1);
});

test("TC-027 the sheet updates with each new result", async ({ page }, info) => {
  const first = studentFor(info.project.name, 18);
  const second = studentFor(info.project.name, 20);
  const printA = printFor(18);
  const printB = printFor(20);
  await registerFace(first, printA);
  await registerFace(second, printB);
  const lessonId = await newLesson([first, second]);
  await startRound(lessonId, [printA, printB]);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  const rowOf = (student: string) => page.locator(`tr[data-student="${student}"]`);
  await expect(rowOf(first)).toContainText("ממתין");
  await page.waitForTimeout(1_000);

  expect((await respondAs(first, lessonId, printA)).status).toBe(200);
  await expect(rowOf(first)).toContainText("נוכח", { timeout: 2_000 });
  expect((await respondAs(second, lessonId, printB)).status).toBe(200);
  await expect(rowOf(second)).toContainText("נוכח", { timeout: 2_000 });
});

test("a student who was not recognised picks a number in the shared photo, and the teacher approves it", async ({ browser, page }, info) => {
  // A teacher and two students, each signing in, take longer than one page.
  test.setTimeout(90_000);
  const known = studentFor(info.project.name, 22);
  const first = studentFor(info.project.name, 26);
  const second = studentFor(info.project.name, 28);
  const print = printFor(22);
  await registerFace(known, print);
  const lessonId = await newLesson([known, first, second]);
  await startRound(lessonId, [print, printFor(97), printFor(98)]);
  expect((await respondAs(known, lessonId, print)).status).toBe(200);
  await endHour(lessonId);
  const names = Object.fromEntries(((await secret.from("people").select("id_number, name").in("id_number", [first, second])).data ?? []).map((row) => [row.id_number, row.name]));

  // The teacher's phone still has the photo, with the three face boxes of the round.
  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, "/");
  await keepClassPhotoOnPhone(teacher, lessonId, await classPhoto(teacher), [
    [100, 75, 300, 350],
    [600, 75, 300, 350],
    [1100, 75, 300, 350],
  ]);
  await teacher.goto(`/lessons/${lessonId}/attendance`);
  await expect(teacher.getByText("בתמונות נמצאו 3 פרצופים. אחד מהם שייך לסטודנט שזוהה, ו־2 לא זוהו.")).toBeVisible();
  await expect(teacher.getByRole("img", { name: "תמונה 1 עם מספרים" })).toBeVisible();
  await teacher.getByRole("button", { name: "שיתוף התמונה עם מספרים" }).click();
  await expect(teacher.getByText("התמונה שותפה עם הסטודנטים שלא זוהו.", { exact: false })).toBeVisible({ timeout: 15_000 });
  const { data: numbers } = await secret.from("photo_numbers").select("number, face_no").eq("lesson_id", lessonId).order("number");
  expect(numbers).toEqual([
    { number: 1, face_no: 1 },
    { number: 2, face_no: 2 },
  ]);

  await openAs(page, first, `/lessons/${lessonId}/attendance`);
  await expect(page.getByRole("img", { name: "תמונת הכיתה 1 עם מספרים" })).toBeVisible();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "אני מספר 1" }).click();
  await expect(page.getByText("בחרת את מספר 1: ממתין לאישור המרצה")).toBeVisible();

  // A second student picks the same number, so both picks wait for the teacher together.
  const other = await signedInClient(second);
  expect((await other.from("number_claims").insert({ lesson_id: lessonId, student_id: second, number: 1 })).error).toBeNull();
  await page.reload();
  await expect(page.getByText("בחרת את מספר 1: הועבר למרצה להמשך טיפול")).toBeVisible();

  await expect(teacher.getByText("2 סטודנטים בחרו את מספר 1").first()).toBeVisible();
  await teacher.getByRole("button", { name: `אישור הבחירה של ${names[first]}` }).click();
  await expect(teacher.locator(`tr[data-student="${first}"]`)).toContainText("נוכח");
  await expect(teacher.getByRole("button", { name: `אישור הבחירה של ${names[second]}` })).toHaveCount(0);
  await context.close();

  await expect(page.getByText("בחרת את מספר 1: אושר")).toBeVisible();
  const { data: claims } = await secret.from("number_claims").select("student_id, status").eq("lesson_id", lessonId).order("student_id");
  expect(claims).toEqual([
    { student_id: first, status: "approved" },
    { student_id: second, status: "rejected" },
  ]);
});

test("the photo can be shared only from the phone that took it", async ({ page }, info) => {
  const student = studentFor(info.project.name, 32);
  const lessonId = await newLesson([student]);
  await startRound(lessonId, [printFor(96)]);
  await endHour(lessonId);

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  await expect(page.getByText("את תמונת הכיתה עם המספרים אפשר לשתף רק מהמכשיר שצילם אותה.")).toBeVisible();

  const context = await page.context().browser()!.newContext();
  const studentPage = await context.newPage();
  await openAs(studentPage, student, `/lessons/${lessonId}/attendance`);
  await expect(studentPage.getByText("המרצה עוד לא שיתף את תמונת הכיתה.")).toBeVisible();
  await context.close();
});

test("TC-028 download the sheet", async ({ page }, info) => {
  const zeroId = info.project.name === "iphone-webkit" ? "012345679" : "012345678";
  await secret.from("people").upsert({ id_number: zeroId, name: "=1+1", role: "student" });
  const print = printFor(30);
  await registerFace(zeroId, print);
  const lessonId = await newLesson([zeroId]);
  await startRound(lessonId, [print]);
  await secret.rpc("record_attendance_match", { p_lesson: lessonId, p_student: zeroId, p_photo: 0, p_face: 0, p_score: 0.9 });

  await openAs(page, ID.T1, `/lessons/${lessonId}/attendance`);
  await expect(page.locator(`tr[data-student="${zeroId}"]`)).toContainText("נוכח");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "הורדת הגיליון" }).click()]);
  const reader = fileURLToPath(new URL("./read-sheet.mjs", import.meta.url));
  const file = JSON.parse(execFileSync(process.execPath, [reader, await download.path()], { encoding: "utf8" })) as {
    rightToLeft: boolean;
    rows: unknown[][];
    formulas: number;
  };

  expect(file.rightToLeft).toBe(true);
  expect(file.formulas).toBe(0);
  expect(file.rows[0]).toEqual(["תעודת זהות", "שם", "נוכחות", "איך הוחלט", "הערה"]);
  const row = file.rows.find((candidate) => candidate[0] === zeroId);
  expect(row?.slice(0, 4)).toEqual([zeroId, "=1+1", "נוכח", "זיהוי פנים"]);
});

test("UC-01 a student who responded sees the result on the attendance tab", async ({ page }, info) => {
  const student = studentFor(info.project.name, 24);
  const print = printFor(24);
  await registerFace(student, print);
  const lessonId = await newLesson([student]);
  await startRound(lessonId, [printFor(77)]);
  expect((await respondAs(student, lessonId, print)).status).toBe(200);

  await openAs(page, student, `/lessons/${lessonId}/attendance`);
  await expect(page.getByText("לא נמצא", { exact: true })).toBeVisible();
  expect(hashOf(print)).toMatch(/^[0-9a-f]{64}$/);
});
