import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { COURSE_A, ID, secretClient, signedIn } from "./helpers.ts";

const secret = secretClient();
const created: string[] = [];
let lectureNumber = 4_000_000 + Math.floor(Math.random() * 1_000_000);

/** Ends the lesson a second ago, with its polls published a minute before that. */
async function endLesson(lessonId: string, pollIds: string[]): Promise<void> {
  await secret.from("surveys").update({ published_at: new Date(Date.now() - 60_000).toISOString() }).in("id", pollIds);
  await secret.from("lessons").update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq("id", lessonId);
}

after(async () => {
  await secret.from("lessons").delete().in("id", created);
});

async function newLesson(hoursFromNow = -0.5, hours = 2): Promise<string> {
  lectureNumber += 1;
  const startsAt = Date.now() + hoursFromNow * 3_600_000;
  const { data, error } = await secret
    .from("lessons")
    .insert({ course_id: COURSE_A, lecture_number: lectureNumber, starts_at: new Date(startsAt).toISOString(), ends_at: new Date(startsAt + hours * 3_600_000).toISOString() })
    .select("id")
    .single();
  assert.equal(error, null);
  created.push(data!.id);
  return data!.id as string;
}

const POLL = [{ id: "q1", type: "single", text: "מה הבנתם?", options: ["הכול", "חלק"] }];
const FORM = [
  { id: "q1", type: "single", text: "בחירה אחת", options: ["א", "ב"] },
  { id: "q2", type: "multiple", text: "כמה בחירות", options: ["א", "ב", "ג"] },
  { id: "q3", type: "rating", text: "דירוג", scale: 5 },
  { id: "q4", type: "text", text: "מה עוד?" },
];
const FORM_ANSWER = { q1: 0, q2: [1, 2], q3: 4, q4: "הכול טוב" };

async function publish(lessonId: string, kind: "poll" | "form", options: { allowChange?: boolean; status?: string } = {}) {
  const teacher = await signedIn("T1");
  return teacher
    .from("surveys")
    .insert({ lesson_id: lessonId, kind, status: options.status ?? "open", allow_change: options.allowChange ?? false, questions: kind === "poll" ? POLL : FORM })
    .select("id, status")
    .single();
}

async function answer(who: keyof typeof ID, surveyId: string, value: unknown) {
  const client = await signedIn(who);
  return client.from("answers").insert({ survey_id: surveyId, student_id: ID[who], value });
}

async function totals(surveyId: string): Promise<Record<number, number>> {
  const { data } = await secret.from("poll_totals").select("option_no, count").eq("survey_id", surveyId);
  return Object.fromEntries((data ?? []).map((row) => [row.option_no, row.count]));
}

describe("polls and forms", () => {
  it("TC-060 the teacher of the lesson publishes a poll at any time, with at least 2 options", async () => {
    const now = await newLesson();
    assert.equal((await publish(now, "poll")).error, null);
    assert.equal((await publish(await newLesson(-5), "poll")).error, null, "after the lesson");
    assert.equal((await publish(await newLesson(48), "poll")).error, null, "before the lesson");

    const otherTeacher = await signedIn("T2");
    assert.ok((await otherTeacher.from("surveys").insert({ lesson_id: now, kind: "poll", questions: POLL })).error, "a teacher of another course");

    const teacher = await signedIn("T1");
    const oneOption = await teacher.from("surveys").insert({ lesson_id: now, kind: "poll", questions: [{ ...POLL[0], options: ["רק אחת"] }] });
    assert.ok(oneOption.error, "one option");

    const student = await signedIn("S1");
    assert.ok((await student.from("surveys").insert({ lesson_id: now, kind: "poll", questions: POLL })).error, "a student");
  });

  it("TC-062 an answer is accepted only while the survey is open", async () => {
    const lessonId = await newLesson();
    for (const kind of ["poll", "form"] as const) {
      const value = kind === "poll" ? { q1: 1 } : FORM_ANSWER;
      const open = (await publish(lessonId, kind)).data!;
      assert.equal((await answer("S1", open.id, value)).error, null, kind);

      const closed = (await publish(lessonId, kind)).data!;
      await (await signedIn("T1")).from("surveys").update({ status: "closed" }).eq("id", closed.id);
      assert.ok((await answer("S1", closed.id, value)).error, `${kind} closed`);
    }
  });

  it("TC-063 a second answer is refused when no change was allowed", async () => {
    const lessonId = await newLesson();
    for (const kind of ["poll", "form"] as const) {
      const value = kind === "poll" ? { q1: 0 } : FORM_ANSWER;
      const survey = (await publish(lessonId, kind)).data!;
      assert.equal((await answer("S1", survey.id, value)).error, null);

      const client = await signedIn("S1");
      const again = await client.from("answers").upsert({ survey_id: survey.id, student_id: ID.S1, value: kind === "poll" ? { q1: 1 } : { ...FORM_ANSWER, q4: "אחר" } });
      assert.ok(again.error, kind);
      const { data } = await secret.from("answers").select("value").eq("survey_id", survey.id).eq("student_id", ID.S1).single();
      assert.deepEqual(data?.value, value);
    }
  });

  it("TC-064 an allowed second answer replaces the first, also in the totals", async () => {
    const lessonId = await newLesson();
    const poll = (await publish(lessonId, "poll", { allowChange: true })).data!;
    assert.equal((await answer("S1", poll.id, { q1: 0 })).error, null);
    assert.deepEqual(await totals(poll.id), { 0: 1 });

    const client = await signedIn("S1");
    assert.equal((await client.from("answers").update({ value: { q1: 1 } }).eq("survey_id", poll.id).eq("student_id", ID.S1)).error, null);
    assert.deepEqual(await totals(poll.id), { 0: 0, 1: 1 });

    const form = (await publish(lessonId, "form", { allowChange: true })).data!;
    await answer("S1", form.id, FORM_ANSWER);
    assert.equal((await client.from("answers").update({ value: { ...FORM_ANSWER, q3: 2 } }).eq("survey_id", form.id).eq("student_id", ID.S1)).error, null);
    const { count } = await secret.from("answers").select("*", { count: "exact", head: true }).eq("survey_id", form.id);
    assert.equal(count, 1);
  });

  it("refuses an option that does not exist, and a form with an unanswered question", async () => {
    const lessonId = await newLesson();
    const poll = (await publish(lessonId, "poll")).data!;
    assert.ok((await answer("S1", poll.id, { q1: 5 })).error, "no such option");
    const form = (await publish(lessonId, "form")).data!;
    assert.ok((await answer("S1", form.id, { q1: 0, q2: [1], q3: 4 })).error, "a question is missing");
    assert.ok((await answer("S1", form.id, { ...FORM_ANSWER, q3: 9 })).error, "a rating out of the scale");
  });

  it("TC-066 only the teacher sees who answered a poll, and everyone sees the totals", async () => {
    const lessonId = await newLesson();
    const poll = (await publish(lessonId, "poll")).data!;
    await answer("S1", poll.id, { q1: 0 });
    await answer("S2", poll.id, { q1: 1 });

    const s2 = await signedIn("S2");
    assert.deepEqual((await s2.from("answers").select("student_id").eq("survey_id", poll.id)).data?.map((a) => a.student_id), [ID.S2]);
    assert.equal((await s2.from("poll_totals").select("count").eq("survey_id", poll.id)).data?.length, 2);

    const teacher = await signedIn("T1");
    assert.equal((await teacher.from("answers").select("student_id").eq("survey_id", poll.id)).data?.length, 2);
  });

  it("TC-067 only the teacher closes a poll or a form", async () => {
    const lessonId = await newLesson();
    for (const kind of ["poll", "form"] as const) {
      const survey = (await publish(lessonId, kind)).data!;
      const student = await signedIn("S1");
      assert.deepEqual((await student.from("surveys").update({ status: "closed" }).eq("id", survey.id).select("status")).data ?? [], []);
      const teacher = await signedIn("T1");
      const closed = await teacher.from("surveys").update({ status: "closed" }).eq("id", survey.id).select("status, closed_at").single();
      assert.equal(closed.data?.status, "closed");
      assert.ok(closed.data?.closed_at);
    }
  });

  it("TC-068 the job closes a poll published before the end of the lesson, and leaves a later poll and a form open", async () => {
    const lessonId = await newLesson(-0.5, 1);
    const poll = (await publish(lessonId, "poll")).data!;
    const form = (await publish(lessonId, "form")).data!;
    await endLesson(lessonId, [poll.id]);
    const later = (await publish(lessonId, "poll")).data!;

    assert.equal((await secret.rpc("run_minute_jobs")).error, null);
    const { data } = await secret.from("surveys").select("id, status").in("id", [poll.id, form.id, later.id]);
    const status = Object.fromEntries((data ?? []).map((row) => [row.id, row.status]));
    assert.equal(status[poll.id], "closed");
    assert.equal(status[form.id], "open");
    assert.equal(status[later.id], "open", "a poll published after the lesson waits for the teacher");
  });

  it("TC-073 only the teacher sees the answers of a form", async () => {
    const lessonId = await newLesson();
    const form = (await publish(lessonId, "form")).data!;
    await answer("S1", form.id, FORM_ANSWER);

    const s2 = await signedIn("S2");
    assert.deepEqual((await s2.from("answers").select("value").eq("survey_id", form.id)).data, []);
    const teacher = await signedIn("T1");
    const { data } = await teacher.from("answers").select("student_id, value").eq("survey_id", form.id).single();
    assert.deepEqual(data, { student_id: ID.S1, value: FORM_ANSWER });
  });

  it("TC-101 every transition of a poll or form", async () => {
    const future = await newLesson(48);
    const draft = (await publish(future, "form", { status: "draft" })).data!;
    assert.equal(draft.status, "draft");
    const s1 = await signedIn("S1");
    assert.deepEqual((await s1.from("surveys").select("id").eq("id", draft.id)).data, [], "a draft is hidden from students");

    const teacher = await signedIn("T1");
    const opened = await teacher.from("surveys").update({ status: "open" }).eq("id", draft.id).select("status, published_at").single();
    assert.equal(opened.data?.status, "open");
    assert.ok(opened.data?.published_at);
    assert.ok((await teacher.from("surveys").update({ status: "draft" }).eq("id", draft.id)).error, "back to draft");

    const now = await newLesson(-0.5, 1);
    const poll = (await publish(now, "poll")).data!;
    assert.equal(poll.status, "open");
    assert.ok((await teacher.from("surveys").insert({ lesson_id: now, kind: "poll", status: "draft", questions: POLL })).error, "a poll has no draft");

    await teacher.from("surveys").update({ status: "closed" }).eq("id", draft.id);
    await endLesson(now, [poll.id]);
    await secret.rpc("run_minute_jobs");
    assert.equal((await secret.from("surveys").select("status").eq("id", poll.id).single()).data?.status, "closed");

    assert.ok((await teacher.from("surveys").update({ status: "open" }).eq("id", poll.id)).error, "a closed poll stays closed");
  });
});
