import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { AttendanceRoutes } from "../src/attendance/AttendanceRoutes.ts";
import { AttendanceRules } from "../src/attendance/AttendanceRules.ts";
import { AttendanceService } from "../src/attendance/AttendanceService.ts";
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
let service: AttendanceService;
let lectureNumber = 1000 + Math.floor(Math.random() * 900_000);
const createdLessons: string[] = [];

type Who = keyof typeof ID;

before(async () => {
  const verifier = new SupabaseUserVerifier(secret);
  const notifications = new NotificationService(new SupabaseNotificationRepository(secret), new SilentSender());
  service = new AttendanceService({ repository: new SupabaseAttendanceRepository(secret), rules: new AttendanceRules(), notifications });
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
after(async () => {
  server.close();
  await secret.from("lessons").delete().in("id", createdLessons);
});

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
  createdLessons.push(data!.id as string);
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

/** The teacher's phone sends the number of faces it found in the class photo. */
async function photograph(lessonId: string, faceCount: number): Promise<void> {
  const { status } = await call("T1", "/attendance/class", { lessonId, faceCount });
  assert.equal(status, 201);
}

/** "I was in the lesson", sent by the student's own page. */
async function confirm(who: Who, lessonId: string, student: string = ID[who]) {
  const client = await signedIn(who);
  return client.from("attendance_confirmations").insert({ lesson_id: lessonId, student_id: student });
}

async function confirmAll(lessonId: string, ...who: Who[]): Promise<void> {
  for (const one of who) assert.equal((await confirm(one, lessonId)).error, null);
}

/** The 4 minutes for confirming end at once. */
async function endConfirming(lessonId: string): Promise<void> {
  const { error } = await secret.from("attendance_rounds").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("lesson_id", lessonId);
  assert.equal(error, null);
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function number(value: number, faceNo: number) {
  return { number: value, photoNo: 0, faceNo, box: [faceNo, faceNo, 40, 40] };
}

/** A number on each of these faces, 1 for face 0 and so on. */
function numbersFor(faceCount: number) {
  return Array.from({ length: faceCount }, (_, faceNo) => number(faceNo + 1, faceNo));
}

/** The teacher's phone shares the class photo, with these numbers drawn on it. */
async function share(who: Who, lessonId: string, numbers: unknown[], bytes: Uint8Array = JPEG_BYTES): Promise<{ status: number; json: Record<string, unknown> }> {
  const client = await signedIn(who);
  const token = (await client.auth.getSession()).data.session!.access_token;
  const form = new FormData();
  form.set("lessonId", lessonId);
  form.set("photoNos", JSON.stringify([0]));
  form.set("numbers", JSON.stringify(numbers));
  form.append("photos", new Blob([bytes], { type: "image/jpeg" }), "0.jpg");
  const response = await fetch(`${base}/attendance/photos`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : {} };
}

async function pick(who: Who, lessonId: string, value: number | null, student: string = ID[who]) {
  const client = await signedIn(who);
  return client.from("number_claims").insert({ lesson_id: lessonId, student_id: student, number: value });
}

interface SheetRow {
  id_number: string;
  attendance: string;
  decided_by: string | null;
  flagged: boolean;
}

/** The teacher's sheet for these students, in the order given. */
async function sheet(lessonId: string, ...who: Who[]): Promise<Pick<SheetRow, "attendance" | "decided_by">[]> {
  const teacher = await signedIn("T1");
  const ids = who.map((one) => ID[one]);
  const { data, error } = await teacher.from("attendance_sheet").select("id_number, attendance, decided_by").eq("lesson_id", lessonId).in("id_number", ids);
  assert.equal(error, null);
  const rows = (data ?? []) as SheetRow[];
  return ids.map((id) => {
    const row = rows.find((item) => item.id_number === id)!;
    return { attendance: row.attendance, decided_by: row.decided_by };
  });
}

describe("the calls of attendance", () => {
  it("refuses a call with no sign-in", async () => {
    const response = await fetch(`${base}/attendance/class`, { method: "POST" });
    assert.equal(response.status, 401);
  });

  it("TC-015 refuses a photo outside the lesson, a second photo, another teacher and a wrong face count", async () => {
    const ended = await call("T1", "/attendance/class", { lessonId: L2, faceCount: 3 });
    assert.deepEqual([ended.status, ended.json.error], [403, "outside_lesson"]);

    const lessonId = await newLesson();
    assert.deepEqual((await call("T1", "/attendance/class", { lessonId, faceCount: -1 })).json.error, "bad_count");
    assert.deepEqual((await call("T1", "/attendance/class", { lessonId })).json.error, "bad_count");
    await photograph(lessonId, 3);
    const again = await call("T1", "/attendance/class", { lessonId, faceCount: 3 });
    assert.deepEqual([again.status, again.json.error], [409, "round_exists"]);

    const otherTeacher = await call("T2", "/attendance/class", { lessonId: await newLesson(), faceCount: 3 });
    assert.equal(otherTeacher.json.error, "not_the_teacher");
    assert.equal((await call("S1", "/attendance/class", { lessonId: await newLesson(), faceCount: 3 })).status, 403);
  });

  it("TC-100 a student confirms only after the photo, only within the 4 minutes, only for themselves and only in their course", async () => {
    const lessonId = await newLesson();
    assert.ok((await confirm("S1", lessonId)).error, "before the photo");

    await photograph(lessonId, 3);
    const { data: round } = await secret.from("attendance_rounds").select("created_at, expires_at, face_count").eq("lesson_id", lessonId).single();
    assert.equal(Date.parse(round!.expires_at) - Date.parse(round!.created_at), 4 * 60_000);
    assert.equal(round!.face_count, 3);

    assert.ok((await confirm("S2", lessonId, ID.S1)).error, "in the name of another student");
    assert.ok((await confirm("S51", lessonId)).error, "a student of another course");
    assert.equal((await confirm("S1", lessonId)).error, null);
    assert.ok((await confirm("S1", lessonId)).error, "one confirmation per lesson");

    await endConfirming(lessonId);
    assert.ok((await confirm("S2", lessonId)).error, "after the 4 minutes");

    const s1 = await signedIn("S1");
    assert.deepEqual((await s1.from("attendance_confirmations").select("student_id").eq("lesson_id", lessonId)).data, [{ student_id: ID.S1 }]);
    const counts = await s1.from("attendance_counts").select("face_count, confirmations").eq("lesson_id", lessonId).single();
    assert.deepEqual(counts.data, { face_count: 3, confirmations: 1 });
  });

  it("TC-021 the sheet: no photo, then confirmed or waiting, then present by confirmation when no more confirmed than the faces", async () => {
    const lessonId = await newLesson();
    assert.deepEqual(await sheet(lessonId, "S1"), [{ attendance: "no_photo", decided_by: null }]);

    await photograph(lessonId, 2);
    await confirmAll(lessonId, "S1", "S2");
    assert.deepEqual(await sheet(lessonId, "S1", "S3"), [
      { attendance: "confirmed", decided_by: null },
      { attendance: "waiting", decided_by: null },
    ]);

    await endConfirming(lessonId);
    assert.deepEqual(await sheet(lessonId, "S1", "S2", "S3"), [
      { attendance: "present", decided_by: "confirmation" },
      { attendance: "present", decided_by: "confirmation" },
      { attendance: "absent", decided_by: null },
    ]);
    const s1 = await signedIn("S1");
    assert.deepEqual((await s1.from("my_attendance").select("attendance, decided_by, confirmed").eq("lesson_id", lessonId)).data, [
      { attendance: "present", decided_by: "confirmation", confirmed: true },
    ]);
  });

  it("the teacher shares the photo only after the 4 minutes, only when more confirmed than the faces, once, and with a number on every face", async () => {
    const lessonId = await newLesson();
    await photograph(lessonId, 1);
    await confirmAll(lessonId, "S1", "S2");

    const early = await share("T1", lessonId, numbersFor(1));
    assert.deepEqual([early.status, early.json.error], [409, "round_open"]);
    await endConfirming(lessonId);
    assert.deepEqual(await sheet(lessonId, "S1"), [{ attendance: "pending", decided_by: null }]);

    assert.equal((await share("T2", lessonId, numbersFor(1))).json.error, "not_the_teacher");
    assert.equal((await share("S2", lessonId, numbersFor(1))).status, 403);
    const missing = await share("T1", lessonId, []);
    assert.deepEqual([missing.status, missing.json.error], [400, "bad_numbers"]);

    const shared = await share("T1", lessonId, numbersFor(1));
    assert.equal(shared.status, 201);
    assert.ok(Date.parse(shared.json.expiresAt as string) > Date.now() + 23 * 3_600_000);
    const again = await share("T1", lessonId, numbersFor(1));
    assert.deepEqual([again.status, again.json.error], [409, "already_shared"]);

    const enough = await newLesson();
    await photograph(enough, 2);
    await confirmAll(enough, "S1", "S2");
    await endConfirming(enough);
    const notNeeded = await share("T1", enough, numbersFor(2));
    assert.deepEqual([notNeeded.status, notNeeded.json.error], [409, "no_need"]);
  });

  it("refuses a file that is not a JPEG", async () => {
    const lessonId = await newLesson();
    await photograph(lessonId, 1);
    await confirmAll(lessonId, "S1", "S2");
    await endConfirming(lessonId);
    const { status, json } = await share("T1", lessonId, numbersFor(1), new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    assert.deepEqual([status, json.error], [400, "bad_photos"]);
  });

  it("only a student who confirmed picks a number and sees the photo; 'not in the photo' waits for the teacher", async () => {
    const lessonId = await newLesson();
    await photograph(lessonId, 1);
    await confirmAll(lessonId, "S1", "S2");
    await endConfirming(lessonId);

    assert.ok((await pick("S1", lessonId, 1)).error, "before the photo is shared");
    assert.equal((await share("T1", lessonId, numbersFor(1))).status, 201);

    assert.ok((await pick("S3", lessonId, 1)).error, "did not confirm");
    assert.ok((await pick("S2", lessonId, 1, ID.S1)).error, "in the name of another student");
    assert.ok((await pick("S1", lessonId, 9)).error, "a number that is not in the photo");
    assert.equal((await pick("S1", lessonId, 1)).error, null);
    assert.ok((await pick("S1", lessonId, 1)).error, "one pick per lesson");
    assert.equal((await pick("S2", lessonId, null)).error, null);

    assert.deepEqual(await sheet(lessonId, "S1", "S2"), [
      { attendance: "present", decided_by: "photo_number" },
      { attendance: "pending", decided_by: null },
    ]);
    const teacher = await signedIn("T1");
    assert.equal((await teacher.from("number_claims").update({ status: "approved" }).eq("lesson_id", lessonId).eq("student_id", ID.S2)).error, null);
    assert.deepEqual(await sheet(lessonId, "S2"), [{ attendance: "present", decided_by: "teacher" }]);

    const { data: photos } = await secret.from("shared_photos").select("file_path").eq("lesson_id", lessonId);
    const path = photos![0]!.file_path as string;
    assert.equal((await (await signedIn("S1")).storage.from("class-photos").download(path)).error, null);
    assert.equal((await teacher.storage.from("class-photos").download(path)).error, null);
    assert.ok((await (await signedIn("S3")).storage.from("class-photos").download(path)).error, "a student who did not confirm");
    assert.ok((await (await signedIn("S51")).storage.from("class-photos").download(path)).error, "a student of another course");
  });

  it("two picks of one number go to the teacher, who approves one, and the other is rejected and flagged", async () => {
    const lessonId = await newLesson();
    await photograph(lessonId, 2);
    await confirmAll(lessonId, "S1", "S2", "S3");
    await endConfirming(lessonId);
    assert.equal((await share("T1", lessonId, numbersFor(2))).status, 201);
    for (const who of ["S1", "S2"] as const) assert.equal((await pick(who, lessonId, 1)).error, null);
    assert.equal((await pick("S3", lessonId, 2)).error, null);

    const s1 = await signedIn("S1");
    const mine = await s1.from("my_number_claim").select("number, status, contested").eq("lesson_id", lessonId).single();
    assert.deepEqual(mine.data, { number: 1, status: "pending", contested: true });
    assert.deepEqual(await sheet(lessonId, "S1", "S2", "S3"), [
      { attendance: "pending", decided_by: null },
      { attendance: "pending", decided_by: null },
      { attendance: "present", decided_by: "photo_number" },
    ]);

    const other = await signedIn("T2");
    assert.deepEqual((await other.from("number_claims").update({ status: "approved" }).eq("lesson_id", lessonId).select()).data, []);

    const teacher = await signedIn("T1");
    assert.equal((await teacher.from("number_claims").update({ status: "approved" }).eq("lesson_id", lessonId).eq("student_id", ID.S1)).error, null);
    assert.deepEqual(await sheet(lessonId, "S1", "S2"), [
      { attendance: "present", decided_by: "teacher" },
      { attendance: "absent", decided_by: "teacher" },
    ]);
    const flags = await teacher.from("attendance_sheet").select("id_number, flagged").eq("lesson_id", lessonId).in("id_number", [ID.S1, ID.S2]).order("id_number");
    assert.deepEqual(flags.data?.map((row) => row.flagged), [false, true]);
    const decided = await secret.from("number_claims").select("decided_at").eq("lesson_id", lessonId).in("student_id", [ID.S1, ID.S2]);
    assert.ok(decided.data?.every((row) => row.decided_at));
  });

  it("deletes a shared photo after its time; then a student who confirmed and did not pick is absent", async () => {
    const lessonId = await newLesson();
    await photograph(lessonId, 1);
    await confirmAll(lessonId, "S1", "S2");
    await endConfirming(lessonId);
    assert.equal((await share("T1", lessonId, numbersFor(1))).status, 201);
    const { data: photos } = await secret.from("shared_photos").select("file_path").eq("lesson_id", lessonId);
    const path = photos![0]!.file_path as string;

    await secret.from("shared_photos").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("lesson_id", lessonId);
    assert.ok((await service.removeExpiredPhotos()) >= 1);

    assert.ok((await secret.storage.from("class-photos").download(path)).error, "the file is gone");
    const { data } = await secret.from("shared_photos").select("file_removed").eq("lesson_id", lessonId).single();
    assert.equal(data?.file_removed, true);
    assert.ok((await pick("S2", lessonId, 1)).error);
    assert.deepEqual(await sheet(lessonId, "S2"), [{ attendance: "absent", decided_by: null }]);
  });

  it("the teacher changes a student's attendance at any time, and can bring back the automatic result", async () => {
    const lessonId = await newLesson();
    const teacher = await signedIn("T1");
    const change = (client: typeof teacher, student: string, present: boolean) =>
      client.from("attendance_overrides").upsert({ lesson_id: lessonId, student_id: student, present }).select("present");

    assert.deepEqual((await change(teacher, ID.S1, true)).data, [{ present: true }]);
    assert.deepEqual(await sheet(lessonId, "S1"), [{ attendance: "present", decided_by: "teacher" }]);
    const row = await teacher.from("attendance_sheet").select("changed_by_teacher").eq("lesson_id", lessonId).eq("id_number", ID.S1).single();
    assert.equal(row.data?.changed_by_teacher, true);

    await photograph(lessonId, 5);
    await confirmAll(lessonId, "S1");
    await endConfirming(lessonId);
    assert.deepEqual((await change(teacher, ID.S1, false)).data, [{ present: false }]);
    assert.deepEqual(await sheet(lessonId, "S1"), [{ attendance: "absent", decided_by: "teacher" }]);

    assert.ok((await change(await signedIn("T2"), ID.S2, true)).error, "another teacher");
    assert.ok((await change(await signedIn("S2"), ID.S2, true)).error, "a student");
    assert.ok((await change(teacher, ID.S51, true)).error, "a student of another course");

    assert.equal((await teacher.from("attendance_overrides").delete().eq("lesson_id", lessonId).eq("student_id", ID.S1)).error, null);
    assert.deepEqual(await sheet(lessonId, "S1"), [{ attendance: "present", decided_by: "confirmation" }]);
  });

  it("the page cannot reach the closed tables or the server's functions", async () => {
    const s1 = await signedIn("S1");
    assert.deepEqual((await s1.from("push_subscriptions").select("endpoint")).data, []);
    assert.ok((await s1.from("attendance_status").select("*")).error, "the status of every student is closed");
    assert.deepEqual((await s1.from("attendance_overrides").select("present")).data, []);
    assert.ok((await s1.rpc("run_minute_jobs")).error);
    assert.ok((await s1.rpc("start_attendance_round", { p_lesson: L2, p_face_count: 0 })).error);
    assert.ok((await s1.from("attendance_rounds").insert({ lesson_id: L2, expires_at: new Date().toISOString(), face_count: 0 })).error);
    assert.deepEqual((await publicClient().from("attendance_sheet").select("*")).data ?? [], []);
    assert.deepEqual((await s1.from("attendance_sheet").select("id_number")).data, []);

    const schedule = await secret.rpc("minute_job_schedule");
    assert.equal(schedule.data, "* * * * *");
    assert.equal((await secret.rpc("run_minute_jobs")).error, null);
  });

  it("no face data is kept: the tables of face recognition are gone", async () => {
    for (const table of ["face_registrations", "face_replacements", "class_faces", "face_sightings", "attendance_results"]) {
      assert.ok((await secret.from(table).select("*").limit(1)).error, table);
    }
  });
});
