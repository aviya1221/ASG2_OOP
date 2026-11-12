import { HttpError } from "../http/errors.ts";
import { LlmError } from "../llm/index.ts";
import type { GuideGenerator } from "./GuideGenerator.ts";
import type { HomeworkRepository } from "./HomeworkRepository.ts";
import { ScoreCalculator } from "./ScoreCalculator.ts";
import type { SolutionReviewer } from "./SolutionReviewer.ts";
import { MAX_CHECKS, type Homework, type HomeworkCheck, type ReportSection, type ReviewGuide, type SectionMark } from "./types.ts";

function noChecksLeft(): HttpError {
  return new HttpError(409, "no_checks_left", "All 3 checks of this homework were used.");
}

/** A failure of the AI service saves nothing, so the teacher can publish again and the check does not count. */
async function withAi<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof LlmError)) throw error;
    console.error(`The AI service failed: ${error.kind}`);
    throw new HttpError(503, "ai_unavailable", "The AI service did not answer. Try again; this check does not count.");
  }
}

/** Publishes homework and checks solutions (docs/07-EDD/homework-review.md). */
export class HomeworkService {
  readonly #repository: HomeworkRepository;
  readonly #guides: GuideGenerator;
  readonly #reviewer: SolutionReviewer;
  readonly #scores: ScoreCalculator;

  constructor(repository: HomeworkRepository, guides: GuideGenerator, reviewer: SolutionReviewer, scores: ScoreCalculator = new ScoreCalculator()) {
    this.#repository = repository;
    this.#guides = guides;
    this.#reviewer = reviewer;
    this.#scores = scores;
  }

  async publish(lessonId: string, teacherId: string, title: string, pdf: Uint8Array): Promise<{ homework: Homework; questions: number }> {
    const lesson = await this.#repository.findLesson(lessonId);
    if (!lesson) throw new HttpError(404, "not_found", "There is no such lesson.");
    if (lesson.teacherId !== teacherId) throw new HttpError(403, "not_the_teacher", "Only the teacher of the course can do this.");
    const guide = await withAi(() => this.#guides.generate(pdf));
    const homework = await this.#repository.saveHomework(lessonId, title, pdf, guide);
    return { homework, questions: guide.questions.length };
  }

  /** Only the teacher of the course deletes a homework, and its guide, checks and file go with it (REQ-74). */
  async remove(homeworkId: string, teacherId: string): Promise<void> {
    const homework = await this.#repository.findHomework(homeworkId);
    if (!homework) throw new HttpError(404, "not_found", "There is no such homework.");
    const lesson = await this.#repository.findLesson(homework.lessonId);
    if (lesson?.teacherId !== teacherId) throw new HttpError(403, "not_the_teacher", "Only the teacher of the course can do this.");
    await this.#repository.deleteHomework(homework);
  }

  /** The solution stays in memory and is dropped when the check ends (REQ-59). */
  async check(homeworkId: string, studentId: string, solution: Uint8Array): Promise<HomeworkCheck> {
    const homework = await this.#repository.findHomework(homeworkId);
    if (!homework) throw new HttpError(404, "not_found", "There is no such homework.");
    if (!(await this.#repository.studiesLesson(homework.lessonId, studentId))) {
      throw new HttpError(403, "not_in_course", "Only a student of the course can do this.");
    }
    let used = await this.#repository.countChecks(homeworkId, studentId);
    if (used >= MAX_CHECKS) throw noChecksLeft();
    const guide = await this.#repository.findGuide(homeworkId);
    if (!guide) throw new HttpError(404, "not_found", "There is no such homework.");

    const marks = await withAi(() => this.#reviewer.review(guide, solution));
    const scored = this.#score(guide, marks);
    for (;;) {
      const check: HomeworkCheck = { homeworkId, studentId, checkNumber: used + 1, ...scored };
      if (await this.#repository.saveCheck(check)) return check;
      used = await this.#repository.countChecks(homeworkId, studentId);
      if (used >= MAX_CHECKS) throw noChecksLeft();
    }
  }

  /** The report and the scores, in the order of the guide. */
  #score(guide: ReviewGuide, marks: SectionMark[]): Omit<HomeworkCheck, "homeworkId" | "studentId" | "checkNumber"> {
    const markOf = new Map(marks.map((mark) => [mark.id, mark]));
    const sections: ReportSection[] = guide.questions.flatMap((question, q) =>
      question.sections.map((section, s) => {
        const mark = markOf.get(section.id)!;
        return { id: section.id, question: q + 1, section: s + 1, score: mark.score, answered: mark.answered, meets: mark.meets, missing: mark.missing, direction: mark.direction };
      }),
    );
    const questionScores = this.#scores.questionScores(guide, marks);
    return {
      sectionScores: sections.map(({ id, question, section, score }) => ({ id, question, section, score })),
      questionScores,
      overall: this.#scores.overall(questionScores),
      report: { sections },
    };
  }
}
