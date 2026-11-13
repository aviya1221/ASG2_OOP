import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COURSE_A, COURSE_B, emailFor, freshNumber, ID, L1, L2, L3, PASSWORD, publicClient, secretClient, signedIn } from "./helpers.ts";

const NEW_COURSE = {
  p_name: "קורס בדיקה",
  p_teacher: { email: emailFor(ID.T1), name: "מרצה ראשון" },
  p_weekly_hours: [
    { day: 0, start: "10:00", end: "12:00" },
    { day: 2, start: "14:00", end: "15:00" },
  ],
  p_first_date: "2027-01-03",
  p_weeks: 3,
  p_students: [
    { email: emailFor(ID.S1), name: "סטודנט 1" },
    { email: emailFor(ID.S2).toUpperCase(), name: "סטודנט 2" },
  ],
};

describe("accounts and timetable", () => {
  it("TC-001 the database gives nothing to someone who has not signed in", async () => {
    const { data, error } = await publicClient().from("lessons").select("id");
    assert.equal(error, null);
    assert.deepEqual(data, []);
  });

  it("TC-002 a new course gets all its lessons, numbered in order, at the local time", async () => {
    const admin = await signedIn("A1");
    const number = freshNumber();
    const { data: courseId, error } = await admin.rpc("create_course", { p_number: number, ...NEW_COURSE });
    assert.equal(error, null);

    const { data: lessons } = await admin
      .from("lessons")
      .select("lecture_number, starts_at, ends_at")
      .eq("course_id", courseId)
      .order("lecture_number");
    assert.equal(lessons?.length, 6);
    assert.deepEqual(lessons?.map((l) => l.lecture_number), [1, 2, 3, 4, 5, 6]);
    assert.equal(new Date(lessons![0]!.starts_at).toISOString(), "2027-01-03T08:00:00.000Z");
    assert.equal(new Date(lessons![1]!.ends_at).toISOString(), "2027-01-05T13:00:00.000Z");

    const { data: students } = await admin.from("course_students").select("student_id").eq("course_id", courseId).order("student_id");
    assert.deepEqual(students?.map((s) => s.student_id), [ID.S1, ID.S2], "the students are found by email, in any letter case");
  });

  it("TC-002 a course number that exists, or a missing detail, is refused and says what to fix", async () => {
    const admin = await signedIn("A1");
    const number = freshNumber();
    assert.equal((await admin.rpc("create_course", { p_number: number, ...NEW_COURSE })).error, null);

    const again = await admin.rpc("create_course", { p_number: number, ...NEW_COURSE });
    assert.equal(again.error?.message, "course_number_exists");

    const noName = await admin.rpc("create_course", { p_number: freshNumber(), ...NEW_COURSE, p_name: " " });
    assert.equal(noName.error?.message, "missing_name");

    const noTeacher = await admin.rpc("create_course", { p_number: freshNumber(), ...NEW_COURSE, p_teacher: { email: " ", name: "מרצה" } });
    assert.equal(noTeacher.error?.message, "missing_teacher");
  });

  it("TC-003 only the admin changes the timetable", async () => {
    const teacher = await signedIn("T1");
    const added = await teacher.from("courses").insert({ number: freshNumber(), name: "x", teacher_id: ID.T1, weekly_hours: [] }).select();
    assert.ok(added.error, "a teacher must not add a course");

    const created = await teacher.rpc("create_course", { p_number: freshNumber(), ...NEW_COURSE });
    assert.equal(created.error?.message, "not_admin");

    const student = await signedIn("S1");
    const changed = await student.from("courses").update({ name: "שונה" }).eq("id", COURSE_A).select();
    assert.deepEqual(changed.data, [], "a student must not change a course");

    const admin = await signedIn("A1");
    const { data: before } = await admin.from("courses").select("name").eq("id", COURSE_A).single();
    const saved = await admin.from("courses").update({ name: "קורס א מעודכן" }).eq("id", COURSE_A).select();
    assert.equal(saved.data?.[0]?.name, "קורס א מעודכן");
    await admin.from("courses").update({ name: before!.name }).eq("id", COURSE_A);
  });

  it("TC-004 users see only their own lessons", async () => {
    for (const who of ["S51", "T2"] as const) {
      const client = await signedIn(who);
      const { data } = await client.from("lessons").select("id, course_id");
      assert.deepEqual([...new Set(data?.map((l) => l.course_id))], [COURSE_B], who);
      assert.deepEqual(data?.map((l) => l.id), [L3], who);
    }

    const student = await signedIn("S1");
    const { data } = await student.from("lessons").select("id");
    const ids = data?.map((l) => l.id) ?? [];
    assert.ok(ids.includes(L1) && ids.includes(L2), "the student sees the lessons of course A");
    assert.ok(!ids.includes(L3), "the student does not see the lessons of course B");
  });

  it("a person sees only their own row, and a teacher also sees the students of their courses", async () => {
    const student = await signedIn("S1");
    const { data: own } = await student.from("people").select("id, email");
    assert.deepEqual(own, [{ id: ID.S1, email: emailFor(ID.S1) }]);

    const teacher = await signedIn("T2");
    const { data: seen } = await teacher.from("people").select("id").order("id");
    assert.deepEqual(seen?.map((p) => p.id), [ID.T2, ID.S51]);
  });

  it("TC-006 a first sign-in by email works only for someone on the list, and only once", async () => {
    const email = `new-${freshNumber()}@users.lesson.invalid`;
    const secret = secretClient();
    const added = await secret.from("people").insert({ email, name: "חדש", role: "student" }).select("id").single();
    assert.equal(added.error, null);
    assert.match(added.data!.id as string, /^[0-9a-f-]{36}$/, "a new person gets an internal id of their own");

    const first = await publicClient().auth.signUp({ email, password: PASSWORD });
    assert.equal(first.error, null);
    const { data: linked } = await secret.from("people").select("user_id").eq("email", email).single();
    assert.equal(linked?.user_id, first.data.user?.id);

    const second = await publicClient().auth.signUp({ email, password: "another-password" });
    assert.ok(second.error || second.data.user?.identities?.length === 0, "a second registration must not create an account");
    assert.ok((await publicClient().auth.signInWithPassword({ email, password: "another-password" })).error);

    const refused = await publicClient().auth.signUp({ email: `stranger-${freshNumber()}@users.lesson.invalid`, password: PASSWORD });
    assert.ok(refused.error, "someone who is not on the list must be refused");

    const badEmail = await secret.from("people").insert({ email: "Not An Email", name: "x", role: "student" });
    assert.ok(badEmail.error, "an email is kept only in small letters and in the form of an address");
  });
});
