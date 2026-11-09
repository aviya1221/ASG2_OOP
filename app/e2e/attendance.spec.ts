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
  newLesson,
  openAs,
  PERSON_PHOTO,
  printFor,
  recordPosts,
  registerFace,
  respondAs,
  secret,
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

test("TC-024 a student picks a seat on the map, and the teacher approves it", async ({ browser, page }, info) => {
  const student = studentFor(info.project.name, 22);
  const lessonId = await newLesson([student]);
  await startRound(lessonId, [printFor(99)]);
  await endHour(lessonId);

  await openAs(page, student, `/lessons/${lessonId}/attendance`);
  await page.getByRole("button", { name: "שורה 3, מושב 5", exact: true }).click();
  await page.getByRole("button", { name: "שליחת בקשה" }).click();
  await expect(page.getByText("בקשה לשורה 3, מושב 5: ממתינה לאישור")).toBeVisible();

  const context = await browser.newContext();
  const teacher = await context.newPage();
  await openAs(teacher, ID.T1, `/lessons/${lessonId}/attendance`);
  const { data } = await secret.from("people").select("name").eq("id_number", student).single();
  await teacher.getByRole("button", { name: `אישור הבקשה של ${data!.name}` }).click();
  await expect(teacher.locator(`tr[data-student="${student}"]`)).toContainText("נוכח");
  await context.close();

  await expect(page.getByText("בקשה לשורה 3, מושב 5: אושרה")).toBeVisible();
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
