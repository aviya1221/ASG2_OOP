import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { AttendanceRoutes } from "../src/attendance/AttendanceRoutes.ts";
import { AttendanceRules } from "../src/attendance/AttendanceRules.ts";
import { AttendanceService, hashOfPrint } from "../src/attendance/AttendanceService.ts";
import { ClassFaceCache } from "../src/attendance/ClassFaceCache.ts";
import { FaceMatcher } from "../src/attendance/FaceMatcher.ts";
import { createApp } from "../src/http/app.ts";
import { SupabaseAttendanceRepository } from "../src/integrations/supabase/SupabaseAttendanceRepository.ts";
import { SupabaseNotificationRepository } from "../src/integrations/supabase/SupabaseNotificationRepository.ts";
import { SupabaseUserVerifier } from "../src/integrations/supabase/SupabaseUserVerifier.ts";
import { SilentSender } from "../src/integrations/webpush/WebPushSender.ts";
import { NotificationService } from "../src/notifications/NotificationService.ts";
import { COURSE_A, ID, L2, publicClient, secretClient, signedIn } from "./helpers.ts";

const secret = secretClient();
let server: Server;
let base: string;
let lectureNumber = 1000 + Math.floor(Math.random() * 900_000);

type Who = keyof typeof ID;

before(async () => {
  const verifier = new SupabaseUserVerifier(secret);
  const notifications = new NotificationService(new SupabaseNotificationRepository(secret), new SilentSender());
  const service = new AttendanceService({
    repository: new SupabaseAttendanceRepository(secret),
    cache: new ClassFaceCache(),
    matcher: new FaceMatcher(),
    rules: new AttendanceRules(),
    notifications,
  });
  const app = createApp({
    webOrigins: ["http://localhost"],
    verifier,
    routers: [new AttendanceRoutes(service, notifications, verifier).router()],
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

/** A face-print with a direction of its own, so different seeds are far apart. */
function printFor(seed: number): number[] {
  const values = Array.from({ length: 128 }, (_, i) => Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % 1);
  const length = Math.hypot(...values);
  return values.map((value) => Math.fround(value / length));
}

/** A face close to both face-prints, as when two people look alike. */
function between(a: number[], b: number[]): number[] {
  const values = a.map((value, i) => value + b[i]!);
  const length = Math.hypot(...values);
  return values.map((value) => value / length);
}

const PRINT_S1 = printFor(1);
const PRINT_S2 = printFor(2);
const PRINT_OTHER = printFor(3);
const hash = (print: number[]) => hashOfPrint(Float32Array.from(print));

async function registerDirectly(idNumber: string, print: number[]): Promise<void> {
  const { error } = await secret.from("face_registrations").upsert({ student_id: idNumber, hash: hash(print), opted_out: false });
  assert.equal(error, null);
}

async function newLesson(ended = false): Promise<string> {
  lectureNumber += 1;
  const now = Date.now();
  const startsAt = new Date(now + (ended ? -3 : -0.5) * 3_600_000).toISOString();
  const endsAt = new Date(now + (ended ? -1 : 1.5) * 3_600_000).toISOString();
  const { data, error } = await secret
    .from("lessons")
    .insert({ course_id: COURSE_A, lecture_number: lectureNumber, starts_at: startsAt, ends_at: endsAt })
    .select("id")
    .single();
  assert.equal(error, null);
  return data!.id as string;
}

async function call(who: Who, path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const client = await signedIn(who);
  const token = (await client.auth.getSession()).data.session!.access_token;
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : {} };
}

function photo(...prints: number[][]) {
  return { faces: prints.map((print, i) => ({ box: [i, i, 40, 40], print })) };
}

async function startRound(lessonId: string, ...prints: number[][]): Promise<void> {
  const { status } = await call("T1", "/attendance/class", { lessonId, photos: [photo(...prints)] });
  assert.equal(status, 201);
}

async function respond(who: Who, lessonId: string, print: number[]) {
  return call(who, "/attendance/response", { lessonId, print, hash: hash(print) });
}

async function endHour(lessonId: string): Promise<void> {
  const { error } = await secret.from("attendance_rounds").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("lesson_id", lessonId);
  assert.equal(error, null);
}

async function resultOf(lessonId: string, idNumber: string): Promise<string | undefined> {
  const { data } = await secret.from("attendance_results").select("result").eq("lesson_id", lessonId).eq("student_id", idNumber).maybeSingle();
  return data?.result;
}

describe("the calls of attendance", () => {
  before(async () => {
    await registerDirectly(ID.S1, PRINT_S1);
    await registerDirectly(ID.S2, PRINT_S2);
  });

  it("refuses a call with no sign-in", async () => {
    const response = await fetch(`${base}/attendance/response`, { method: "POST" });
    assert.equal(response.status, 401);
  });

  it("refuses a face-print of the wrong length", async () => {
    const { status, json } = await call("S1", "/attendance/response", { lessonId: "x", print: [1, 2], hash: "x" });
    assert.equal(status, 400);
    assert.equal(json.error, "bad_print");
  });

  it("TC-013 replacing a face waits for a teacher of the student", async () => {
    const original = await secret.from("face_registrations").select("hash").eq("student_id", ID.S2).single();
    const newHash = hash(printFor(77));

    const { status, json } = await call("S2", "/faces/register", { hash: newHash });
    assert.equal(status, 202);
    assert.equal(json.status, "waiting_for_teacher");
    const unchanged = await secret.from("face_registrations").select("hash").eq("student_id", ID.S2).single();
    assert.equal(unchanged.data?.hash, original.data?.hash);

    const other = await signedIn("T2");
    const refused = await other.from("face_replacements").update({ status: "approved" }).eq("student_id", ID.S2).eq("status", "pending").select("status");
    assert.deepEqual(refused.data, []);

    const teacher = await signedIn("T1");
    const seen = await teacher.from("face_replacements").select("new_hash").eq("student_id", ID.S2);
    assert.ok(seen.error, "a teacher must not read the new hash");

    const approved = await teacher.from("face_replacements").update({ status: "approved" }).eq("student_id", ID.S2).eq("status", "pending").select("status");
    assert.equal(approved.error, null);
    const replaced = await secret.from("face_registrations").select("hash").eq("student_id", ID.S2).single();
    assert.equal(replaced.data?.hash, newHash);

    await registerDirectly(ID.S2, PRINT_S2);
  });

  it("TC-015 refuses a round outside the lesson, and a second round", async () => {
    const ended = await call("T1", "/attendance/class", { lessonId: L2, photos: [photo(PRINT_S1)] });
    assert.equal(ended.status, 403);
    assert.equal(ended.json.error, "outside_lesson");

    const lessonId = await newLesson();
    assert.equal((await call("T1", "/attendance/class", { lessonId, photos: [photo(PRINT_S1)] })).status, 201);
    const again = await call("T1", "/attendance/class", { lessonId, photos: [photo(PRINT_S1)] });
    assert.equal(again.status, 409);
    assert.equal(again.json.error, "round_exists");

    const otherTeacher = await call("T2", "/attendance/class", { lessonId: await newLesson(), photos: [photo(PRINT_S1)] });
    assert.equal(otherTeacher.json.error, "not_the_teacher");
  });

  it("TC-019 two students on one face get Conflict, also the one who was present", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, between(PRINT_S1, PRINT_S2), PRINT_OTHER);

    assert.equal((await respond("S1", lessonId, PRINT_S1)).json.result, "present");
    assert.equal((await respond("S2", lessonId, PRINT_S2)).json.result, "conflict");
    assert.equal(await resultOf(lessonId, ID.S1), "conflict");
  });

  it("TC-020 two responses at the same moment cannot both be Present", async () => {
    for (let i = 0; i < 20; i++) {
      const lessonId = await newLesson();
      await startRound(lessonId, between(PRINT_S1, PRINT_S2));
      const [first, second] = await Promise.all([respond("S1", lessonId, PRINT_S1), respond("S2", lessonId, PRINT_S2)]);
      assert.deepEqual([first.status, second.status], [200, 200]);
      assert.equal(await resultOf(lessonId, ID.S1), "conflict", `round ${i}`);
      assert.equal(await resultOf(lessonId, ID.S2), "conflict", `round ${i}`);
    }
  });

  it("TC-021 the sheet shows No response only after the hour", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_S1);
    const teacher = await signedIn("T1");

    const sheet = async () => (await teacher.from("attendance_sheet").select("attendance").eq("lesson_id", lessonId).eq("id_number", ID.S1).single()).data?.attendance;
    assert.equal(await sheet(), null);
    await endHour(lessonId);
    assert.equal(await sheet(), "no_response");
  });

  it("TC-023 a student asks for row and seat only when allowed", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_OTHER);
    const SEAT = { lesson_id: lessonId, row_no: 3, seat_no: 5 };

    const s1 = await signedIn("S1");
    assert.ok((await s1.from("seat_requests").insert({ ...SEAT, student_id: ID.S1 })).error, "during the hour");

    const present = await newLesson();
    await startRound(present, PRINT_S2);
    await respond("S2", present, PRINT_S2);

    await endHour(lessonId);
    await endHour(present);
    assert.equal((await s1.from("seat_requests").insert({ ...SEAT, student_id: ID.S1 })).error, null, "after the hour");

    const s2 = await signedIn("S2");
    assert.ok((await s2.from("seat_requests").insert({ ...SEAT, lesson_id: present, student_id: ID.S2 })).error, "already present");
    assert.ok((await s2.from("seat_requests").insert({ ...SEAT, row_no: 16, student_id: ID.S2 })).error, "row outside the map");
    assert.ok((await s2.from("seat_requests").insert({ ...SEAT, student_id: ID.S1 })).error, "in the name of another student");
  });

  it("TC-023 a student who opted out asks during the hour", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_OTHER);
    await call("S2", "/faces/register", { optOut: true });
    const s2 = await signedIn("S2");
    const status = await s2.from("my_face_status").select("registered, opted_out").single();
    assert.deepEqual(status.data, { registered: false, opted_out: true });
    assert.equal((await s2.from("seat_requests").insert({ lesson_id: lessonId, student_id: ID.S2, row_no: 1, seat_no: 1 })).error, null);
    await registerDirectly(ID.S2, PRINT_S2);
  });

  it("TC-024 the teacher decides a request, and only that teacher", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_OTHER);
    await endHour(lessonId);
    for (const who of ["S1", "S2"] as const) {
      const client = await signedIn(who);
      assert.equal((await client.from("seat_requests").insert({ lesson_id: lessonId, student_id: ID[who], row_no: 2, seat_no: 2 })).error, null);
    }

    const other = await signedIn("T2");
    assert.deepEqual((await other.from("seat_requests").update({ status: "approved" }).eq("lesson_id", lessonId).select()).data, []);

    const teacher = await signedIn("T1");
    assert.equal((await teacher.from("seat_requests").update({ status: "approved" }).eq("lesson_id", lessonId).eq("student_id", ID.S1)).error, null);
    assert.equal((await teacher.from("seat_requests").update({ status: "rejected" }).eq("lesson_id", lessonId).eq("student_id", ID.S2)).error, null);

    const { data } = await teacher.from("attendance_sheet").select("id_number, attendance, decided_by").eq("lesson_id", lessonId).in("id_number", [ID.S1, ID.S2]).order("id_number");
    assert.deepEqual(data, [
      { id_number: ID.S1, attendance: "present", decided_by: "row_and_seat" },
      { id_number: ID.S2, attendance: "no_response", decided_by: null },
    ]);
  });

  it("TC-025 a request is kept, one per lesson", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_OTHER);
    await endHour(lessonId);
    const s1 = await signedIn("S1");
    assert.equal((await s1.from("seat_requests").insert({ lesson_id: lessonId, student_id: ID.S1, row_no: 3, seat_no: 5 })).error, null);
    assert.ok((await s1.from("seat_requests").insert({ lesson_id: lessonId, student_id: ID.S1, row_no: 4, seat_no: 6 })).error);

    const teacher = await signedIn("T1");
    const { data } = await teacher.from("seat_requests").select("row_no, seat_no, status, created_at").eq("lesson_id", lessonId).eq("student_id", ID.S1).single();
    assert.equal(data?.row_no, 3);
    assert.equal(data?.status, "pending");
    assert.ok(data?.created_at);
  });

  it("TC-026 a rejected request, or 3 requests in the course, flags the student", async () => {
    const lessons = [await newLesson(), await newLesson(), await newLesson()];
    for (const lessonId of lessons) {
      await startRound(lessonId, PRINT_OTHER);
    }
    const insert = (lessonId: string, student: string, status: string) =>
      secret.from("seat_requests").upsert({ lesson_id: lessonId, student_id: student, row_no: 1, seat_no: 1, status });

    const S3 = "300000003";
    const S4 = "300000004";
    const S5 = "300000005";
    await insert(lessons[0]!, S3, "rejected");
    await insert(lessons[0]!, S4, "approved");
    await insert(lessons[1]!, S4, "approved");
    for (const lessonId of lessons) await insert(lessonId, S5, "approved");

    const teacher = await signedIn("T1");
    const { data } = await teacher.from("attendance_sheet").select("id_number, flagged").eq("lesson_id", lessons[2]!).in("id_number", [S3, S4, S5]).order("id_number");
    assert.deepEqual(data?.map((row) => row.flagged), [true, false, true]);

    await secret.from("seat_requests").delete().in("student_id", [S3, S4, S5]);
  });

  it("TC-029 no table keeps the face-print of a student", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_OTHER);
    await respond("S1", lessonId, PRINT_S1);
    const { data } = await secret.from("attendance_results").select("*").eq("lesson_id", lessonId).eq("student_id", ID.S1).single();
    assert.deepEqual(Object.keys(data!).sort(), ["decided_at", "face_no", "lesson_id", "photo_no", "result", "score", "student_id"]);
    const { data: faces } = await secret.from("class_faces").select("print").eq("lesson_id", lessonId);
    assert.equal(faces?.length, 1, "only the faces from the photo");
  });

  it("TC-100 every transition of a round: open, then closed with its face-prints deleted", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_S1);
    assert.equal((await respond("S1", lessonId, PRINT_S1)).json.result, "present");

    const schedule = await secret.rpc("minute_job_schedule");
    assert.equal(schedule.data, "* * * * *");

    await endHour(lessonId);
    assert.equal((await secret.rpc("run_minute_jobs")).error, null);
    const { data } = await secret.from("class_faces").select("face_no").eq("lesson_id", lessonId);
    assert.deepEqual(data, []);

    const late = await respond("S2", lessonId, PRINT_S2);
    assert.equal(late.status, 409);
    assert.equal(late.json.error, "round_closed");
  });

  it("the job leaves the face-prints of open rounds", async () => {
    const lessonId = await newLesson();
    await startRound(lessonId, PRINT_S1);
    await secret.rpc("run_minute_jobs");
    const { data } = await secret.from("class_faces").select("face_no").eq("lesson_id", lessonId);
    assert.equal(data?.length, 1);
  });

  it("the page cannot reach the closed tables or the server's functions", async () => {
    const s1 = await signedIn("S1");
    assert.deepEqual((await s1.from("class_faces").select("print")).data, []);
    assert.deepEqual((await s1.from("face_registrations").select("hash")).data, []);
    assert.deepEqual((await s1.from("push_subscriptions").select("endpoint")).data, []);
    assert.ok((await s1.rpc("run_minute_jobs")).error);
    assert.ok((await s1.rpc("record_attendance_match", { p_lesson: L2, p_student: ID.S1, p_photo: 0, p_face: 0, p_score: 1 })).error);
    assert.ok((await s1.from("attendance_results").insert({ lesson_id: L2, student_id: ID.S1, result: "present" })).error);
    assert.deepEqual((await publicClient().from("attendance_sheet").select("*")).data ?? [], []);
    assert.deepEqual((await s1.from("attendance_sheet").select("id_number")).data, []);
  });
});
