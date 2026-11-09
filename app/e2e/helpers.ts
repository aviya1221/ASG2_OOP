import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** The made-up people and lessons of supabase/seed.sql and scripts/seed-users.mjs. */
export const ID = { A1: "100000001", T1: "200000001", S1: "300000001", S51: "300000051" } as const;
export const L1 = "11111111-0000-4000-8000-000000000001";
export const PASSWORD = "local-test-password";
export const SERVER_URL = "http://127.0.0.1:8787";
const EMAIL_DOMAIN = "users.lesson.invalid";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };
export const secret = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, NO_SESSION);

export async function signIn(page: Page, idNumber: string, password: string = PASSWORD): Promise<void> {
  await page.getByLabel("תעודת זהות").fill(idNumber);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
}

/** Opens an address as this user, and waits until the user is signed in. */
export async function openAs(page: Page, idNumber: string, path: string): Promise<void> {
  await page.goto(path);
  await signIn(page, idNumber);
  await expect(page.getByLabel("תעודת זהות")).toHaveCount(0);
}

/** Student number `n` of course A, chosen so that two browsers running one test do not share a student. */
export function studentFor(projectName: string, base: number): string {
  const offset = projectName === "iphone-webkit" ? 1 : 0;
  return `3${String(base + offset).padStart(8, "0")}`;
}

/** A face-print with a direction of its own: numbers from a seeded generator, so different seeds are far apart. */
export function printFor(seed: number): number[] {
  let state = (seed * 2654435761) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
  const values = Array.from({ length: 128 }, next);
  const length = Math.hypot(...values);
  return values.map((value) => Math.fround(value / length));
}

export function hashOf(print: number[]): string {
  return createHash("sha256").update(Buffer.from(Float32Array.from(print).buffer)).digest("hex");
}

let lectureNumber = 2_000_000 + Math.floor(Math.random() * 1_000_000);

/** A lesson in progress, in a course of its own, so one test's round reaches only that test's students. */
export async function newLesson(students: string[] = []): Promise<string> {
  lectureNumber += 1 + Math.floor(Math.random() * 1000);
  const number = `E2E-${lectureNumber}`;
  const course = await secret
    .from("courses")
    .insert({ number, name: "קורס בדיקה", teacher_id_number: ID.T1, weekly_hours: [{ day: 0, start: "10:00", end: "12:00" }] })
    .select("id")
    .single();
  if (course.error) throw new Error(course.error.message);
  const courseId = course.data.id as string;

  if (students.length > 0) {
    const added = await secret.from("course_students").insert(students.map((student_id_number) => ({ course_id: courseId, student_id_number })));
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

/** Opens a round directly in the database. */
export async function startRound(lessonId: string, prints: number[][]): Promise<void> {
  const faces = prints.map((print, face_no) => ({ photo_no: 0, face_no, box: [face_no, 0, 40, 40], print }));
  const { error } = await secret.rpc("start_attendance_round", { p_lesson: lessonId, p_faces: faces });
  if (error) throw new Error(error.message);
}

export async function endHour(lessonId: string): Promise<void> {
  const { error } = await secret.from("attendance_rounds").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
}

export async function clearFace(idNumber: string): Promise<void> {
  await secret.from("face_replacements").delete().eq("student_id", idNumber);
  await secret.from("face_registrations").delete().eq("student_id", idNumber);
}

export async function registerFace(idNumber: string, print: number[]): Promise<void> {
  const { error } = await secret.from("face_registrations").upsert({ student_id: idNumber, hash: hashOf(print), opted_out: false });
  if (error) throw new Error(error.message);
}

/** Puts the face-print on this browser, as a registration on this phone would. */
export async function storeFaceInBrowser(page: Page, idNumber: string, print: number[]): Promise<void> {
  await page.addInitScript(
    ([id, value]) => localStorage.setItem(`face-print:${id}`, value as string),
    [idNumber, JSON.stringify({ print, hash: hashOf(print) })],
  );
}

/** The student's phone sends a response to the server. */
export async function respondAs(idNumber: string, lessonId: string, print: number[]): Promise<Response> {
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLIC_KEY!, NO_SESSION);
  const { data, error } = await client.auth.signInWithPassword({ email: `${idNumber}@${EMAIL_DOMAIN}`, password: PASSWORD });
  if (error) throw new Error(error.message);
  return fetch(`${SERVER_URL}/attendance/response`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ lessonId, print, hash: hashOf(print) }),
  });
}

const dataUrl = (name: string) => `data:image/jpeg;base64,${readFileSync(new URL(`./photos/${name}`, import.meta.url)).toString("base64")}`;

export const PERSON_PHOTO = fileURLToPath(new URL("./photos/person-1.jpg", import.meta.url));

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

/** A photo with no face in it. */
export async function blankPhoto(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#88aa99";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  return { name: "blank.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

export function recordPosts(page: Page): { url: string; body: string }[] {
  const posts: { url: string; body: string }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push({ url: request.url(), body: request.postData() ?? "" });
  });
  return posts;
}
