import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { HomeworkRoutes } from "../../src/homework/HomeworkRoutes.ts";
import type { HomeworkService } from "../../src/homework/HomeworkService.ts";
import type { HomeworkCheck } from "../../src/homework/types.ts";
import { createApp } from "../../src/http/app.ts";
import type { SignedInUser, UserVerifier } from "../../src/http/auth.ts";
import { PDF_BYTES } from "./helpers.ts";

const USERS: Record<string, SignedInUser> = {
  teacher: { userId: "u-t1", idNumber: "T1", role: "teacher" },
  student: { userId: "u-s1", idNumber: "S1", role: "student" },
};
const verifier: UserVerifier = { verify: async (token) => USERS[token] ?? null };

const CHECK: HomeworkCheck = {
  homeworkId: "h1",
  studentId: "S1",
  checkNumber: 1,
  sectionScores: [{ id: "q1_a", question: 1, section: 1, score: 72 }],
  questionScores: [{ id: "q1", question: 1, score: 72 }],
  overall: 72,
  report: { sections: [{ id: "q1_a", question: 1, section: 1, score: 72, answered: true, meets: "עומד", missing: "חסר", direction: "כיוון" }] },
};

const received: { method: string; args: unknown[] }[] = [];
const service = {
  publish: async (...args: unknown[]) => {
    received.push({ method: "publish", args });
    return { homework: { id: "h1", lessonId: "L1", title: "מטלה 1", filePath: "L1/h1.pdf" }, questions: 2 };
  },
  check: async (...args: unknown[]) => {
    received.push({ method: "check", args });
    return CHECK;
  },
} as unknown as HomeworkService;

function form(fields: Record<string, string>, file?: { field: string; bytes: Uint8Array; type: string }): FormData {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  if (file) body.append(file.field, new Blob([new Uint8Array(file.bytes)], { type: file.type }), "file.pdf");
  return body;
}

describe("HomeworkRoutes", () => {
  let server: Server;
  let base: string;

  before(async () => {
    const app = createApp({ webOrigins: ["http://localhost"], verifier, routers: [new HomeworkRoutes(service, verifier).router()] });
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  const post = async (path: string, token: string, body: FormData) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body });
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
  };

  it("publishes a PDF from the teacher and answers with the homework and its number of questions", async () => {
    received.length = 0;
    const answer = await post("/homework", "teacher", form({ lessonId: "L1", title: "  מטלה 1 " }, { field: "file", bytes: PDF_BYTES, type: "application/pdf" }));

    assert.equal(answer.status, 201);
    assert.deepEqual(answer.json, { homeworkId: "h1", questions: 2 });
    const [lessonId, teacherId, title, pdf] = received[0]!.args as [string, string, string, Uint8Array];
    assert.deepEqual([lessonId, teacherId, title], ["L1", "T1", "מטלה 1"]);
    assert.deepEqual(new Uint8Array(pdf), PDF_BYTES);
  });

  it("refuses a student who publishes, a file that is not a PDF and a file over 20 MB", async () => {
    const pdf = { field: "file", bytes: PDF_BYTES, type: "application/pdf" };
    assert.equal((await post("/homework", "student", form({ lessonId: "L1", title: "מטלה" }, pdf))).json.error, "not_the_teacher");

    const text = { field: "file", bytes: new TextEncoder().encode("just text"), type: "text/plain" };
    const notPdf = await post("/homework", "teacher", form({ lessonId: "L1", title: "מטלה" }, text));
    assert.deepEqual([notPdf.status, notPdf.json.error], [400, "not_a_pdf"]);
    const renamed = { ...text, type: "application/pdf" };
    assert.equal((await post("/homework", "teacher", form({ lessonId: "L1", title: "מטלה" }, renamed))).json.error, "not_a_pdf");

    const large = new Uint8Array(20 * 1024 * 1024 + 1);
    large.set(PDF_BYTES);
    const tooLarge = await post("/homework", "teacher", form({ lessonId: "L1", title: "מטלה" }, { ...pdf, bytes: large }));
    assert.deepEqual([tooLarge.status, tooLarge.json.error], [413, "file_too_large"]);
  });

  it("refuses a teacher who checks a solution, and a check with no file", async () => {
    const solution = { field: "solution", bytes: PDF_BYTES, type: "application/pdf" };
    assert.equal((await post("/homework/h1/checks", "teacher", form({}, solution))).json.error, "not_in_course");
    assert.equal((await post("/homework/h1/checks", "student", form({}))).json.error, "not_a_pdf");
  });

  it("TC-139 hands the solution to the service as bytes in memory, never as a file on disk, and answers with the report", async () => {
    received.length = 0;
    const answer = await post("/homework/h1/checks", "student", form({}, { field: "solution", bytes: PDF_BYTES, type: "application/pdf" }));

    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, { checkNumber: 1, overall: 72, questionScores: CHECK.questionScores, report: CHECK.report });
    const [homeworkId, studentId, solution] = received[0]!.args as [string, string, Uint8Array];
    assert.deepEqual([homeworkId, studentId], ["h1", "S1"]);
    assert.ok(solution instanceof Uint8Array);
    assert.deepEqual(new Uint8Array(solution), PDF_BYTES);
  });
});
