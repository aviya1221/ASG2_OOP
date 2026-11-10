import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GuideGenerator } from "../../src/homework/GuideGenerator.ts";
import type { HomeworkRepository } from "../../src/homework/HomeworkRepository.ts";
import { HomeworkService } from "../../src/homework/HomeworkService.ts";
import { SolutionReviewer } from "../../src/homework/SolutionReviewer.ts";
import type { Homework, HomeworkCheck, HomeworkLesson, ReviewGuide, SectionMark } from "../../src/homework/types.ts";
import { FakeLlmClient, LlmError, type LlmJsonRequest } from "../../src/llm/index.ts";
import { answerOf, guideOf, mark, PDF_BYTES } from "./helpers.ts";

const GUIDE = guideOf({ q1: ["q1_a", "q1_b"], q2: ["q2_a"] });
const MARKS = [mark("q1_a", 80), mark("q1_b", 61), mark("q2_a", 0)];
const SOLUTION = new TextEncoder().encode("%PDF-1.4 the solution of S1");

class FakeRepository implements HomeworkRepository {
  lesson: HomeworkLesson | null = { teacherId: "T1" };
  homework: Homework | null = { id: "h1", lessonId: "L1", title: "מטלה 1", filePath: "L1/h1.pdf" };
  students = new Set(["S1"]);
  guide: ReviewGuide | null = GUIDE;
  checks: HomeworkCheck[] = [];
  published: { lessonId: string; title: string; pdf: Uint8Array; guide: ReviewGuide }[] = [];
  /** How many saves find their number taken by a request sent at the same time. */
  takenBySameTime = 0;

  async findLesson() {
    return this.lesson;
  }
  async saveHomework(lessonId: string, title: string, pdf: Uint8Array, guide: ReviewGuide) {
    this.published.push({ lessonId, title, pdf, guide });
    return { id: "h2", lessonId, title, filePath: `${lessonId}/h2.pdf` };
  }
  async findHomework() {
    return this.homework;
  }
  async studiesLesson(_lessonId: string, studentId: string) {
    return this.students.has(studentId);
  }
  async findGuide() {
    return this.guide;
  }
  async countChecks(_homeworkId: string, studentId: string) {
    return this.checks.filter((check) => check.studentId === studentId).length;
  }
  async saveCheck(check: HomeworkCheck) {
    this.checks.push(check);
    if (this.takenBySameTime === 0) return true;
    this.takenBySameTime -= 1;
    return false;
  }
}

/** A reviewer that answers with the next result: marks, or an error to throw. */
function reviewerOf(results: (SectionMark[] | Error)[]) {
  const calls: number[] = [];
  const reviewer = {
    review: async () => {
      calls.push(1);
      const result = results[Math.min(calls.length - 1, results.length - 1)]!;
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as SolutionReviewer;
  return { reviewer, calls };
}

const guidesOf = (generate: () => Promise<ReviewGuide>) => ({ generate }) as unknown as GuideGenerator;
const noGuides = guidesOf(async () => GUIDE);

describe("HomeworkService.check", () => {
  it("TC-136 counts only checks that were saved: a failure is not saved, and the fourth check is refused", async () => {
    const repository = new FakeRepository();
    const { reviewer, calls } = reviewerOf([new LlmError("unavailable", "busy", { status: 503 }), MARKS]);
    const service = new HomeworkService(repository, noGuides, reviewer);

    await assert.rejects(service.check("h1", "S1", SOLUTION), { status: 503, code: "ai_unavailable" });
    assert.equal(repository.checks.length, 0);

    for (const number of [1, 2, 3]) assert.equal((await service.check("h1", "S1", SOLUTION)).checkNumber, number);
    await assert.rejects(service.check("h1", "S1", SOLUTION), { status: 409, code: "no_checks_left" });
    assert.equal(calls.length, 4);
  });

  it("TC-139 keeps only the scores, the report and the check number, and sends the solution inside the request", async () => {
    const repository = new FakeRepository();
    const llm = new FakeLlmClient({ json: () => answerOf(MARKS) });
    await new HomeworkService(repository, noGuides, new SolutionReviewer(llm)).check("h1", "S1", SOLUTION);

    assert.deepEqual(Object.keys(repository.checks[0]!).sort(), ["checkNumber", "homeworkId", "overall", "questionScores", "report", "sectionScores", "studentId"]);
    assert.ok(!JSON.stringify(repository.checks[0]).includes("the solution of S1"));
    assert.equal(llm.calls.filter((call) => call.method === "uploadFile").length, 0);
    const request = llm.calls[0]!.input as LlmJsonRequest<unknown>;
    assert.deepEqual(request.attachments, [{ mimeType: "application/pdf", data: SOLUTION }]);
  });

  it("builds the report and the scores in the order of the guide, with the number of each question and section", async () => {
    const repository = new FakeRepository();
    const { reviewer } = reviewerOf([[mark("q2_a", 0), mark("q1_b", 61), mark("q1_a", 80)]]);
    const check = await new HomeworkService(repository, noGuides, reviewer).check("h1", "S1", SOLUTION);

    assert.deepEqual(
      check.report.sections.map(({ id, question, section, score, answered }) => [id, question, section, score, answered]),
      [
        ["q1_a", 1, 1, 80, true],
        ["q1_b", 1, 2, 61, true],
        ["q2_a", 2, 1, 0, false],
      ],
    );
    assert.deepEqual(check.sectionScores, [
      { id: "q1_a", question: 1, section: 1, score: 80 },
      { id: "q1_b", question: 1, section: 2, score: 61 },
      { id: "q2_a", question: 2, section: 1, score: 0 },
    ]);
    assert.deepEqual(check.questionScores, [
      { id: "q1", question: 1, score: 70.5 },
      { id: "q2", question: 2, score: 0 },
    ]);
    assert.equal(check.overall, 35);
  });

  it("refuses a student of another course and a homework that does not exist", async () => {
    const repository = new FakeRepository();
    const service = new HomeworkService(repository, noGuides, reviewerOf([MARKS]).reviewer);
    await assert.rejects(service.check("h1", "S51", SOLUTION), { status: 403, code: "not_in_course" });
    repository.homework = null;
    await assert.rejects(service.check("h9", "S1", SOLUTION), { status: 404, code: "not_found" });
  });

  it("gives a check sent at the same time as another the next free number, and refuses it when none is left", async () => {
    const repository = new FakeRepository();
    repository.takenBySameTime = 1;
    const service = new HomeworkService(repository, noGuides, reviewerOf([MARKS]).reviewer);
    assert.equal((await service.check("h1", "S1", SOLUTION)).checkNumber, 2);

    repository.takenBySameTime = 1;
    await assert.rejects(service.check("h1", "S1", SOLUTION), { status: 409, code: "no_checks_left" });
  });
});

describe("HomeworkService with the canned answers of the offline demo", () => {
  it("publishes and checks with no scripted answers, marking every section as not answered", async () => {
    const repository = new FakeRepository();
    const llm = new FakeLlmClient();
    const service = new HomeworkService(repository, new GuideGenerator(llm), new SolutionReviewer(llm));

    const { questions } = await service.publish("L1", "T1", "מטלה", PDF_BYTES);
    repository.guide = repository.published[0]!.guide;
    const check = await service.check("h1", "S1", SOLUTION);

    assert.equal(questions, 1);
    assert.deepEqual(check.report.sections.map(({ answered, score, meets }) => [answered, score, meets]), [[false, 0, ""]]);
    assert.equal(check.overall, 1);
  });
});

describe("HomeworkService.publish", () => {
  it("publishes for the teacher of the lesson with the guide made from the PDF", async () => {
    const repository = new FakeRepository();
    const generated: Uint8Array[] = [];
    const guides = guidesOf(async () => {
      generated.push(PDF_BYTES);
      return GUIDE;
    });
    const result = await new HomeworkService(repository, guides, reviewerOf([MARKS]).reviewer).publish("L1", "T1", "מטלה 2", PDF_BYTES);

    assert.deepEqual(result, { homework: { id: "h2", lessonId: "L1", title: "מטלה 2", filePath: "L1/h2.pdf" }, questions: 2 });
    assert.equal(generated.length, 1);
    assert.deepEqual(repository.published, [{ lessonId: "L1", title: "מטלה 2", pdf: PDF_BYTES, guide: GUIDE }]);
  });

  it("refuses another teacher and a lesson that does not exist, and saves nothing when the guide fails", async () => {
    const repository = new FakeRepository();
    const failing = guidesOf(async () => {
      throw new LlmError("rate-limit", "20 requests a day", { status: 429 });
    });
    const service = new HomeworkService(repository, failing, reviewerOf([MARKS]).reviewer);

    await assert.rejects(service.publish("L1", "T2", "מטלה", PDF_BYTES), { status: 403, code: "not_the_teacher" });
    await assert.rejects(service.publish("L1", "T1", "מטלה", PDF_BYTES), { status: 503, code: "ai_unavailable" });
    assert.equal(repository.published.length, 0);
    repository.lesson = null;
    await assert.rejects(service.publish("L9", "T1", "מטלה", PDF_BYTES), { status: 404, code: "not_found" });
  });
});
