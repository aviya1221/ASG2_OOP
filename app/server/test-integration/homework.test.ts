import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { GUIDE_RULES, GuideGenerator } from "../src/homework/GuideGenerator.ts";
import { HomeworkRoutes } from "../src/homework/HomeworkRoutes.ts";
import { HomeworkService } from "../src/homework/HomeworkService.ts";
import { SolutionReviewer } from "../src/homework/SolutionReviewer.ts";
import { createApp } from "../src/http/app.ts";
import { SupabaseHomeworkRepository } from "../src/integrations/supabase/SupabaseHomeworkRepository.ts";
import { SupabaseUserVerifier } from "../src/integrations/supabase/SupabaseUserVerifier.ts";
import { FakeLlmClient, LlmError, type LlmJsonRequest } from "../src/llm/index.ts";
import { COURSE_A, secretClient, signedIn } from "./helpers.ts";

const secret = secretClient();
const created: string[] = [];
let lectureNumber = 6_000_000 + Math.floor(Math.random() * 1_000_000);
let server: Server;
let base: string;

const HOMEWORK_PDF = new TextEncoder().encode("%PDF-1.4 a made-up homework in probability");
const SOLUTION_PDF = new TextEncoder().encode("%PDF-1.4 a made-up solution");

const GUIDE = {
  subject: "הסתברות",
  questions: [
    { id: "q1", title: "שאלה 1", sections: ["q1_a", "q1_b"].map((id) => section(id)) },
    { id: "q2", title: "שאלה 2", sections: [section("q2_a")] },
  ],
  system_prompt: "הנחיות לבודק",
};

function section(id: string) {
  return { id, asked: "מה נשאל", requirements: ["להראות את הדרך"], expected: "התוצאה", score_bands: "טווחים", giving_away: "התוצאה עצמה" };
}

/** The score the fake reviewer gives every section of the next check, and whether the next check fails. */
let reviewScore = 70;
let failNext = false;

const llm = new FakeLlmClient({
  json: (request: LlmJsonRequest<unknown>) => {
    if (request.instructions === GUIDE_RULES) return GUIDE;
    if (failNext) {
      failNext = false;
      throw new LlmError("unavailable", "The model is busy", { status: 503 });
    }
    const ids = ((request.schema.properties as any).sections.items.properties.id.enum as string[]) ?? [];
    return { sections: ids.map((id) => ({ id, evidence: "ציטוט", answered: true, score: reviewScore, meets: "עומד בדרישות", missing: "חסר נימוק", direction: "לבדוק את השלב האחרון" })) };
  },
});

const reviewRequests = () =>
  llm.calls.map((call) => call.input as LlmJsonRequest<unknown>).filter((request) => request.instructions !== GUIDE_RULES);

before(async () => {
  const verifier = new SupabaseUserVerifier(secret);
  const service = new HomeworkService(new SupabaseHomeworkRepository(secret), new GuideGenerator(llm), new SolutionReviewer(llm));
  const app = createApp({ webOrigins: ["http://localhost"], verifier, routers: [new HomeworkRoutes(service, verifier).router()] });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  const { data } = await secret.from("homework").select("file_path").in("lesson_id", created);
  const files = (data ?? []).map((row) => row.file_path as string);
  if (files.length > 0) await secret.storage.from("homework").remove(files);
  await secret.from("lessons").delete().in("id", created);
});

async function newLesson(): Promise<string> {
  lectureNumber += 1;
  const start = Date.now() - 0.5 * 3_600_000;
  const { data, error } = await secret
    .from("lessons")
    .insert({ course_id: COURSE_A, lecture_number: lectureNumber, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 7_200_000).toISOString() })
    .select("id")
    .single();
  assert.equal(error, null);
  created.push(data!.id);
  return data!.id as string;
}

async function post(path: string, who: "T1" | "S1" | "S2", field: string, bytes: Uint8Array, fields: Record<string, string> = {}, type = "application/pdf") {
  const client = await signedIn(who);
  const token = (await client.auth.getSession()).data.session!.access_token;
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append(field, new Blob([new Uint8Array(bytes)], { type }), "file.pdf");
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: response.status, json: (await response.json()) as Record<string, any> };
}

async function publish(lessonId: string, who: "T1" | "S1" = "T1") {
  return post("/homework", who, "file", HOMEWORK_PDF, { lessonId, title: "מטלה 1" });
}

async function check(homeworkId: string, who: "S1" | "S2" = "S1") {
  return post(`/homework/${homeworkId}/checks`, who, "solution", SOLUTION_PDF);
}

describe("the homework review", () => {
  it("TC-130 the teacher publishes a PDF that the lesson's students can open, and a student of another course cannot", async () => {
    const lessonId = await newLesson();
    assert.equal((await publish(lessonId, "S1")).status, 403);
    const published = await publish(lessonId);
    assert.equal(published.status, 201);
    assert.equal(published.json.questions, 2);

    const student = await signedIn("S1");
    const { data: rows } = await student.from("homework").select("id, title, file_path").eq("lesson_id", lessonId);
    assert.deepEqual(rows?.map((row) => [row.id, row.title]), [[published.json.homeworkId, "מטלה 1"]]);
    const file = await student.storage.from("homework").download(rows![0]!.file_path);
    assert.equal(file.error, null);
    assert.deepEqual(new Uint8Array(await file.data!.arrayBuffer()), HOMEWORK_PDF);

    const other = await signedIn("S51");
    assert.deepEqual((await other.from("homework").select("id").eq("lesson_id", lessonId)).data, []);
    assert.ok((await other.storage.from("homework").download(rows![0]!.file_path)).error);
  });

  it("TC-131 the guide is made once, every check sends the same guide, and a student reads none of it", async () => {
    const lessonId = await newLesson();
    const guidesBefore = llm.calls.length - reviewRequests().length;
    const reviewsBefore = reviewRequests().length;
    const { json } = await publish(lessonId);
    await check(json.homeworkId, "S1");
    await check(json.homeworkId, "S2");

    assert.equal(llm.calls.length - reviewRequests().length - guidesBefore, 1);
    const [first, second] = reviewRequests().slice(reviewsBefore);
    assert.ok(first!.instructions!.includes(JSON.stringify(GUIDE.questions)));
    assert.equal(first!.instructions, second!.instructions);

    const student = await signedIn("S1");
    const guides = await student.from("review_guides").select("*").eq("homework_id", json.homeworkId);
    assert.equal(guides.error, null);
    assert.deepEqual(guides.data, []);
  });

  it("TC-133 the report reaches only the student who asked", async () => {
    const lessonId = await newLesson();
    const { json } = await publish(lessonId);
    const answer = await check(json.homeworkId, "S1");
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json.report.sections[0], { id: "q1_a", question: 1, section: 1, score: 70, answered: true, meets: "עומד בדרישות", missing: "חסר נימוק", direction: "לבדוק את השלב האחרון" });

    const own = await (await signedIn("S1")).from("homework_checks").select("report").eq("homework_id", json.homeworkId);
    assert.equal(own.data?.length, 1);
    for (const who of ["S2", "T1"] as const) {
      const others = await (await signedIn(who)).from("homework_checks").select("report").eq("homework_id", json.homeworkId);
      assert.deepEqual(others.data, [], `${who} must not read the report of S1`);
    }
  });

  it("TC-136 a failed check is not saved, three checks are allowed, the fourth is refused, and the chart shows the third", async () => {
    const lessonId = await newLesson();
    const { json } = await publish(lessonId);
    const student = await signedIn("S1");

    failNext = true;
    const failed = await check(json.homeworkId);
    assert.deepEqual([failed.status, failed.json.error], [503, "ai_unavailable"]);
    assert.deepEqual((await student.from("homework_checks").select("check_number").eq("homework_id", json.homeworkId)).data, []);

    for (const [number, score] of [[1, 40], [2, 60], [3, 80]] as const) {
      reviewScore = score;
      assert.equal((await check(json.homeworkId)).json.checkNumber, number);
    }
    reviewScore = 70;
    const fourth = await check(json.homeworkId);
    assert.deepEqual([fourth.status, fourth.json.error], [409, "no_checks_left"]);

    const mine = await student.from("homework_chart").select("name, is_me, overall").eq("homework_id", json.homeworkId);
    assert.equal(mine.data?.length, 1);
    assert.equal(mine.data![0]!.overall, 80);
    assert.equal(mine.data![0]!.is_me, true);
    const seenByOther = await (await signedIn("S2")).from("homework_chart").select("name, is_me, overall").eq("homework_id", json.homeworkId);
    assert.equal(seenByOther.data![0]!.is_me, false);
    assert.equal(typeof seenByOther.data![0]!.name, "string");
  });

  it("TC-139 the database keeps only the scores, the report, the check number and the time, and the solution is never uploaded", async () => {
    const lessonId = await newLesson();
    const { json } = await publish(lessonId);
    const uploadsBefore = llm.calls.filter((call) => call.method === "uploadFile").length;
    await check(json.homeworkId);

    const { data } = await secret.from("homework_checks").select("*").eq("homework_id", json.homeworkId);
    assert.deepEqual(Object.keys(data![0]!).sort(), ["check_number", "created_at", "homework_id", "overall", "question_scores", "report", "section_scores", "student_id"]);
    assert.equal(llm.calls.filter((call) => call.method === "uploadFile").length, uploadsBefore);
    const { data: files } = await secret.storage.from("homework").list(lessonId);
    assert.equal(files?.length, 1, "only the homework itself is stored, never a solution");
  });

  it("TC-142 the teacher deletes a homework with its file and checks, and another teacher cannot", async () => {
    const lessonId = await newLesson();
    const { json } = await publish(lessonId);
    await check(json.homeworkId);
    const remove = async (who: "T1" | "T2") => {
      const token = (await (await signedIn(who)).auth.getSession()).data.session!.access_token;
      return fetch(`${base}/homework/${json.homeworkId}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    };

    assert.equal((await remove("T2")).status, 403);
    assert.equal((await secret.from("homework").select("id").eq("id", json.homeworkId)).data?.length, 1);
    assert.equal((await remove("T1")).status, 204);

    for (const table of ["homework", "review_guides", "homework_checks"]) {
      const column = table === "homework" ? "id" : "homework_id";
      assert.deepEqual((await secret.from(table).select(column).eq(column, json.homeworkId)).data, [], `${table} still has the homework`);
    }
    const { data: files } = await secret.storage.from("homework").list(lessonId);
    assert.equal(files?.length, 0, "the PDF is deleted too");
  });

  it("TC-144 a homework published in one lesson is listed for the whole course, newest first, with its lecture", async () => {
    const first = await newLesson();
    const second = await newLesson();
    const older = await post("/homework", "T1", "file", HOMEWORK_PDF, { lessonId: first, title: "מטלה ישנה" });
    const newer = await post("/homework", "T1", "file", HOMEWORK_PDF, { lessonId: second, title: "מטלה חדשה" });
    assert.equal(older.status, 201);
    assert.equal(newer.status, 201);
    const { data: lesson } = await secret.from("lessons").select("lecture_number").eq("id", first).single();

    // The query of the homework tab of any lesson of the course.
    const student = await signedIn("S1");
    const { data: rows, error } = await student
      .from("homework")
      .select("id, lessons!inner(course_id, lecture_number)")
      .eq("lessons.course_id", COURSE_A)
      .order("created_at", { ascending: false });
    assert.equal(error, null);
    const ids = rows!.map((row) => row.id as string);
    assert.ok(ids.includes(older.json.homeworkId) && ids.includes(newer.json.homeworkId));
    assert.ok(ids.indexOf(newer.json.homeworkId) < ids.indexOf(older.json.homeworkId));
    const olderRow = rows!.find((row) => row.id === older.json.homeworkId)!;
    assert.equal((olderRow.lessons as unknown as { lecture_number: number }).lecture_number, lesson!.lecture_number);

    // A student checks the older homework, whichever lesson they came from, and a student of another course sees neither.
    assert.equal((await check(older.json.homeworkId)).status, 200);
    const other = await signedIn("S51");
    const seen = await other.from("homework").select("id").in("id", [older.json.homeworkId, newer.json.homeworkId]);
    assert.deepEqual(seen.data, []);
  });

  it("refuses a file that is not a PDF", async () => {
    const lessonId = await newLesson();
    const answer = await post("/homework", "T1", "file", new TextEncoder().encode("notes"), { lessonId, title: "מטלה" }, "text/plain");
    assert.deepEqual([answer.status, answer.json.error], [400, "not_a_pdf"]);
  });
});
