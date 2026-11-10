import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { COURSE_A, ID, L2, secretClient, signedIn } from "./helpers.ts";

const secret = secretClient();
const created: string[] = [];
let lectureNumber = 3_000_000 + Math.floor(Math.random() * 1_000_000);

after(async () => {
  await secret.from("lessons").delete().in("id", created);
});

async function newLesson(hoursFromNow = -0.5): Promise<string> {
  lectureNumber += 1;
  const startsAt = Date.now() + hoursFromNow * 3_600_000;
  const { data, error } = await secret
    .from("lessons")
    .insert({ course_id: COURSE_A, lecture_number: lectureNumber, starts_at: new Date(startsAt).toISOString(), ends_at: new Date(startsAt + 7_200_000).toISOString() })
    .select("id")
    .single();
  assert.equal(error, null);
  created.push(data!.id);
  return data!.id as string;
}

async function post(who: keyof typeof ID, lessonId: string, text: string, showName = true, replyTo: string | null = null) {
  const client = await signedIn(who);
  return client.rpc("post_message", { p_lesson: lessonId, p_text: text, p_reply_to: replyTo, p_show_name: showName });
}

describe("the forum", () => {
  it("TC-040 each lesson has its own forum", async () => {
    const lessonId = await newLesson();
    const { error } = await post("S1", lessonId, "שאלה על השיעור");
    assert.equal(error, null);

    const s1 = await signedIn("S1");
    const here = await s1.from("forum_messages").select("text").eq("lesson_id", lessonId);
    assert.deepEqual(here.data?.map((m) => m.text), ["שאלה על השיעור"]);
    const elsewhere = await s1.from("forum_messages").select("text").eq("lesson_id", L2).eq("text", "שאלה על השיעור");
    assert.deepEqual(elsewhere.data, []);
  });

  it("TC-042 the teacher enters the topic, and a student cannot", async () => {
    const lessonId = await newLesson();
    const teacher = await signedIn("T1");
    assert.equal((await teacher.from("lessons").update({ topic: "דרישות" }).eq("id", lessonId)).error, null);

    const student = await signedIn("S1");
    const refused = await student.from("lessons").update({ topic: "אחר" }).eq("id", lessonId).select("topic");
    assert.deepEqual(refused.data, []);

    const { data } = await secret.from("lessons").select("topic").eq("id", lessonId).single();
    assert.equal(data?.topic, "דרישות");
    assert.ok((await teacher.from("lessons").update({ starts_at: new Date().toISOString() }).eq("id", lessonId)).error, "only the topic may change");
  });

  it("TC-043 a forum never closes", async () => {
    const lessonId = await newLesson(-24 * 365);
    assert.equal((await post("S1", lessonId, "הודעה ישנה")).error, null);
    assert.equal((await post("S2", lessonId, "הודעה חדשה, שנה אחרי")).error, null);
    const s1 = await signedIn("S1");
    const { data } = await s1.from("forum_messages").select("text").eq("lesson_id", lessonId).order("created_at");
    assert.deepEqual(data?.map((m) => m.text), ["הודעה ישנה", "הודעה חדשה, שנה אחרי"]);
  });

  it("TC-045 a reply sits under its message, and someone not linked to the lesson cannot post", async () => {
    const lessonId = await newLesson();
    const { data: parent } = await post("S1", lessonId, "שאלה");
    const reply = await post("S2", lessonId, "תשובה", true, parent.id);
    assert.equal(reply.data?.reply_to, parent.id);

    const stranger = await post("S51", lessonId, "אני לא בקורס");
    assert.ok(stranger.error);
  });

  it("TC-046 a hidden name stays hidden from the class, and the teacher sees it", async () => {
    const lessonId = await newLesson();
    const { data: message } = await post("S1", lessonId, "שאלה בלי שם", false);
    assert.equal(message.writer_name, null);

    const s2 = await signedIn("S2");
    const seen = await s2.from("forum_messages").select("writer_name").eq("id", message.id).single();
    assert.equal(seen.data?.writer_name, null);
    assert.deepEqual((await s2.from("message_writers").select("writer_id").eq("message_id", message.id)).data, []);

    const teacher = await signedIn("T1");
    const writer = await teacher.from("message_writers").select("writer_id").eq("message_id", message.id).single();
    assert.equal(writer.data?.writer_id, ID.S1);

    const { data: fromTeacher } = await post("T1", lessonId, "הודעה מהמרצה", false);
    assert.equal(fromTeacher.writer_name, "מרצה ראשון");
    assert.equal(fromTeacher.writer_is_teacher, true);
  });

  it("TC-047 a message is plain text, and an empty or very long one is refused", async () => {
    const lessonId = await newLesson();
    const { data } = await post("S1", lessonId, "<b>לא מודגש</b> https://example.com");
    assert.equal(data.text, "<b>לא מודגש</b> https://example.com");
    assert.equal((await post("S1", lessonId, "   ")).error?.message, "empty_message");
    assert.equal((await post("S1", lessonId, "א".repeat(2001))).error?.message, "message_too_long");
  });

  it("TC-048 nobody can edit a message", async () => {
    const lessonId = await newLesson();
    const { data: message } = await post("S1", lessonId, "המקור");
    for (const who of ["S1", "T1"] as const) {
      const client = await signedIn(who);
      assert.ok((await client.from("forum_messages").update({ text: "שונה" }).eq("id", message.id)).error, who);
    }
    const { data } = await secret.from("forum_messages").select("text").eq("id", message.id).single();
    assert.equal(data?.text, "המקור");
  });

  it("TC-049 only the teacher deletes a message, and its reply stays", async () => {
    const lessonId = await newLesson();
    const { data: message } = await post("S1", lessonId, "למחיקה");
    const { data: reply } = await post("S2", lessonId, "תגובה", true, message.id);

    const s1 = await signedIn("S1");
    assert.ok((await s1.rpc("remove_message", { p_message: message.id })).error);

    const teacher = await signedIn("T1");
    assert.equal((await teacher.rpc("remove_message", { p_message: message.id })).error, null);

    const s2 = await signedIn("S2");
    const { data } = await s2.from("forum_messages").select("id, text, writer_name, deleted_at, reply_to").eq("lesson_id", lessonId).order("created_at");
    assert.equal(data?.[0]?.text, "");
    assert.equal(data?.[0]?.writer_name, null);
    assert.ok(data?.[0]?.deleted_at);
    assert.equal(data?.[1]?.id, reply.id);
    assert.equal(data?.[1]?.reply_to, message.id);
    assert.deepEqual((await teacher.from("message_writers").select("writer_id").eq("message_id", message.id)).data, []);
  });

  it("the page cannot write messages directly", async () => {
    const lessonId = await newLesson();
    const s1 = await signedIn("S1");
    assert.ok((await s1.from("forum_messages").insert({ lesson_id: lessonId, text: "עוקף" })).error);
    assert.ok((await s1.from("message_writers").insert({ message_id: lessonId, writer_id: ID.S1 })).error);
  });
});
