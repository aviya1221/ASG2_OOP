import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/http/app.ts";
import { SupabaseSummaryRepository } from "../src/integrations/supabase/SupabaseSummaryRepository.ts";
import { SupabaseUserVerifier } from "../src/integrations/supabase/SupabaseUserVerifier.ts";
import { FakeLlmClient, type LlmClient, type LlmJsonRequest } from "../src/llm/index.ts";
import { SummaryGenerator } from "../src/summaries/SummaryGenerator.ts";
import { SummaryRoutes } from "../src/summaries/SummaryRoutes.ts";
import { SummaryService } from "../src/summaries/SummaryService.ts";
import { COURSE_A, secretClient, signedIn } from "./helpers.ts";

const secret = secretClient();
const created: string[] = [];
let lectureNumber = 5_000_000 + Math.floor(Math.random() * 1_000_000);
let server: Server;
let base: string;

/** Lets a test hold the AI service, to look at the page while the summary is in progress. */
let gate: Promise<void> = Promise.resolve();
let overview = "סיכום חדש";

const PARTS = () => ({ overview, topics: [{ title: "נושא", start: "00:10" }], questions: [], board: [], lesson_topic: "נושא מהסיכום" });
const llm = new FakeLlmClient({
  json: (request: LlmJsonRequest<unknown>) => (request.prompt.startsWith("Transcribe") ? { utterances: [], on_screen: [] } : PARTS()),
});
const heldLlm: LlmClient = {
  generateText: (request) => llm.generateText(request),
  generateJson: async <T,>(request: LlmJsonRequest<T>) => {
    await gate;
    return llm.generateJson(request);
  },
  uploadFile: (file) => llm.uploadFile(file),
  deleteFile: (file) => llm.deleteFile(file),
  embed: (texts) => llm.embed(texts),
};

let lastFinished: Promise<void> = Promise.resolve();

before(async () => {
  const verifier = new SupabaseUserVerifier(secret);
  const service = new SummaryService(new SupabaseSummaryRepository(secret), new SummaryGenerator(heldLlm, { extract: async (path) => path }));
  const start = service.start.bind(service);
  service.start = async (...args) => {
    const result = await start(...args);
    lastFinished = result.finished;
    return result;
  };
  const app = createApp({ webOrigins: ["http://localhost"], verifier, routers: [new SummaryRoutes(service, verifier).router()] });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await secret.from("lessons").delete().in("id", created);
});

async function newLesson(ended: boolean, topic: string | null = null): Promise<string> {
  lectureNumber += 1;
  const start = Date.now() + (ended ? -3 : -0.5) * 3_600_000;
  const { data, error } = await secret
    .from("lessons")
    .insert({ course_id: COURSE_A, lecture_number: lectureNumber, topic, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 7_200_000).toISOString() })
    .select("id")
    .single();
  assert.equal(error, null);
  created.push(data!.id);
  return data!.id as string;
}

async function upload(lessonId: string, who: "T1" | "S1" = "T1") {
  const client = await signedIn(who);
  const token = (await client.auth.getSession()).data.session!.access_token;
  const form = new FormData();
  form.append("lessonId", lessonId);
  form.append("recording", new Blob([new Uint8Array(1024)], { type: "video/mp4" }), "lesson.mp4");
  const response = await fetch(`${base}/summaries`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: response.status, json: (await response.json()) as Record<string, string> };
}

async function summaryOf(lessonId: string) {
  return (await secret.from("lesson_summaries").select("*").eq("lesson_id", lessonId).maybeSingle()).data;
}

describe("the lesson summary", () => {
  it("TC-080 a recording is accepted only after the lesson, and only from its teacher", async () => {
    const now = await newLesson(false);
    const early = await upload(now);
    assert.equal(early.status, 409);
    assert.equal(early.json.error, "lesson_not_ended");

    const ended = await newLesson(true);
    assert.equal((await upload(ended, "S1")).status, 403);
    const accepted = await upload(ended);
    assert.equal(accepted.status, 202);
    assert.deepEqual(accepted.json, { status: "in_progress" });
    await lastFinished;
    assert.equal((await summaryOf(ended))?.status, "ready");
  });

  it("TC-081 each upload makes a new summary, and the old text stays while the new one is made", async () => {
    const lessonId = await newLesson(true);
    overview = "הסיכום הראשון";
    await upload(lessonId);
    await lastFinished;

    let open!: () => void;
    gate = new Promise((resolve) => {
      open = resolve;
    });
    overview = "הסיכום השני";
    await upload(lessonId);
    const during = await summaryOf(lessonId);
    assert.equal(during?.status, "in_progress");
    assert.equal(during?.overview, "הסיכום הראשון");

    open();
    await lastFinished;
    gate = Promise.resolve();
    const done = await summaryOf(lessonId);
    assert.equal(done?.status, "ready");
    assert.equal(done?.overview, "הסיכום השני");
  });

  it("TC-087 the teacher edits the summary, a student cannot, and nobody changes the status", async () => {
    const lessonId = await newLesson(true);
    await upload(lessonId);
    await lastFinished;

    const teacher = await signedIn("T1");
    const edited = await teacher.from("lesson_summaries").update({ overview: "תוקן בידי המרצה" }).eq("lesson_id", lessonId).select("overview").single();
    assert.equal(edited.data?.overview, "תוקן בידי המרצה");

    const student = await signedIn("S1");
    assert.deepEqual((await student.from("lesson_summaries").update({ overview: "שונה" }).eq("lesson_id", lessonId).select("overview")).data, []);
    assert.ok((await teacher.from("lesson_summaries").update({ status: "failed" }).eq("lesson_id", lessonId)).error);
    assert.equal((await student.from("lesson_summaries").select("overview").eq("lesson_id", lessonId).single()).data?.overview, "תוקן בידי המרצה");
  });

  it("TC-089 the forum takes the topic from the summary only when the lesson has none", async () => {
    const empty = await newLesson(true);
    const named = await newLesson(true, "הנושא של המרצה");
    for (const lessonId of [empty, named]) {
      await upload(lessonId);
      await lastFinished;
    }
    const { data } = await secret.from("lessons").select("id, topic").in("id", [empty, named]);
    const topics = Object.fromEntries((data ?? []).map((row) => [row.id, row.topic]));
    assert.equal(topics[empty], "נושא מהסיכום");
    assert.equal(topics[named], "הנושא של המרצה");
  });

  it("refuses a file that is not a recording", async () => {
    const lessonId = await newLesson(true);
    const client = await signedIn("T1");
    const token = (await client.auth.getSession()).data.session!.access_token;
    const form = new FormData();
    form.append("lessonId", lessonId);
    form.append("recording", new Blob(["text"], { type: "text/plain" }), "notes.txt");
    const response = await fetch(`${base}/summaries`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
    assert.equal(response.status, 400);
  });
});
