import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** The internal ids of the made-up people, and the lessons, of supabase/seed.sql and scripts/seed-users.mjs. */
export const ID = { A1: "100000001", T1: "200000001", S1: "300000001", S51: "300000051" } as const;
export const L1 = "11111111-0000-4000-8000-000000000001";
export const PASSWORD = "local-test-password";
export const SERVER_URL = "http://127.0.0.1:8787";
const EMAIL_DOMAIN = "users.lesson.invalid";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };
export const secret = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, NO_SESSION);

/** The made-up email of a person of the seed: their internal id at an address that cannot exist. */
export function emailFor(personId: string): string {
  return `${personId}@${EMAIL_DOMAIN}`;
}

export async function signIn(page: Page, personId: string, password: string = PASSWORD): Promise<void> {
  await page.getByLabel("אימייל").fill(emailFor(personId));
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
}

/** Opens an address as this user, and waits until the user is signed in. */
export async function openAs(page: Page, personId: string, path: string): Promise<void> {
  await page.goto(path);
  await signIn(page, personId);
  await expect(page.getByLabel("אימייל")).toHaveCount(0);
}

/** Student number `n` of course A, chosen so that two browsers running one test do not share a student. */
export function studentFor(projectName: string, base: number): string {
  const offset = projectName === "iphone-webkit" ? 1 : 0;
  return `3${String(base + offset).padStart(8, "0")}`;
}

let lectureNumber = 2_000_000 + Math.floor(Math.random() * 1_000_000);

/** A lesson in progress, in a course of its own, so one test's round reaches only that test's students. */
export async function newLesson(students: string[] = []): Promise<string> {
  lectureNumber += 1 + Math.floor(Math.random() * 1000);
  const number = `E2E-${lectureNumber}`;
  const course = await secret
    .from("courses")
    .insert({ number, name: "קורס בדיקה", teacher_id: ID.T1, weekly_hours: [{ day: 0, start: "10:00", end: "12:00" }] })
    .select("id")
    .single();
  if (course.error) throw new Error(course.error.message);
  const courseId = course.data.id as string;

  if (students.length > 0) {
    const added = await secret.from("course_students").insert(students.map((student_id) => ({ course_id: courseId, student_id })));
    if (added.error) throw new Error(added.error.message);
  }

  const now = Date.now();
  const { data, error } = await secret
    .from("lessons")
    .insert({ course_id: courseId, lecture_number: 1, starts_at: new Date(now - 1_800_000).toISOString(), ends_at: new Date(now + 5_400_000).toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** A course of its own with these students and lessons, for tests that need several lessons. */
export async function newCourse(students: string[], lessons: { number: number; topic?: string; hoursFromNow?: number }[]): Promise<string[]> {
  const first = await newLesson(students);
  const { data } = await secret.from("lessons").select("course_id").eq("id", first).single();
  await secret.from("lessons").delete().eq("id", first);
  const ids: string[] = [];
  for (const lesson of lessons) {
    const startsAt = Date.now() + (lesson.hoursFromNow ?? -0.5) * 3_600_000;
    const { data: row, error } = await secret
      .from("lessons")
      .insert({ course_id: data!.course_id, lecture_number: lesson.number, topic: lesson.topic ?? null, starts_at: new Date(startsAt).toISOString(), ends_at: new Date(startsAt + 7_200_000).toISOString() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    ids.push(row.id as string);
  }
  return ids;
}

/** A signed-in connection to the database, as the phone of this person has. */
export async function signedInClient(idNumber: string) {
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLIC_KEY!, NO_SESSION);
  const { error } = await client.auth.signInWithPassword({ email: emailFor(idNumber), password: PASSWORD });
  if (error) throw new Error(error.message);
  return client;
}

/** The teacher's phone sent the number of faces in the class photo: the 4 minutes for confirming start. */
export async function photograph(lessonId: string, faceCount: number): Promise<void> {
  const { error } = await secret.rpc("start_attendance_round", { p_lesson: lessonId, p_face_count: faceCount });
  if (error) throw new Error(error.message);
}

/** The 4 minutes for confirming end at once. */
export async function endConfirming(lessonId: string): Promise<void> {
  const { error } = await secret.from("attendance_rounds").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
}

/** "I was in the lesson", sent from the student's own phone. */
export async function confirmAs(idNumber: string, lessonId: string): Promise<void> {
  const client = await signedInClient(idNumber);
  const { error } = await client.from("attendance_confirmations").insert({ lesson_id: lessonId, student_id: idNumber });
  if (error) throw new Error(error.message);
}

const dataUrl = (name: string) => `data:image/jpeg;base64,${readFileSync(new URL(`./photos/${name}`, import.meta.url)).toString("base64")}`;

/** A photo of a class of three made-up people, drawn on a canvas in the browser. */
export async function classPhoto(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const sources = ["person-1.jpg", "person-2.jpg", "person-3.jpg"].map(dataUrl);
  const base64 = await page.evaluate(async (urls) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 500;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#777777";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const [index, url] of urls.entries()) {
      const image = new Image();
      image.src = url;
      await image.decode();
      context.drawImage(image, 25 + index * 500, 25, 450, 450);
    }
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1]!;
  }, sources);
  return { name: "class.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

/** Puts the class photo on the teacher's phone, as sending the face count does (ClassPhotoStore). */
export async function keepClassPhotoOnPhone(page: Page, lessonId: string, photo: { buffer: Buffer }, boxes: number[][]): Promise<void> {
  await page.evaluate(
    async ({ lessonId, base64, boxes }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("class-photos", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("rounds", { keyPath: "lessonId" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("rounds", "readwrite");
        transaction.objectStore("rounds").put({ lessonId, savedAt: Date.now(), photos: [{ jpeg: bytes.buffer, width: 1500, height: 500, boxes }] });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    },
    { lessonId, base64: photo.buffer.toString("base64"), boxes },
  );
}

export function recordPosts(page: Page): { url: string; body: string }[] {
  const posts: { url: string; body: string }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push({ url: request.url(), body: request.postData() ?? "" });
  });
  return posts;
}
