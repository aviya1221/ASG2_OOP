import type { QuestionScore, ReviewGuide, SectionMark } from "./types.ts";

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The scores of a check, calculated by the server from the marks of the sections (REQ-55). */
export class ScoreCalculator {
  /** Each question's score is the plain average of its sections, in the order of the guide. */
  questionScores(guide: ReviewGuide, marks: SectionMark[]): QuestionScore[] {
    const scoreOf = new Map(marks.map((mark) => [mark.id, mark.score]));
    return guide.questions.map((question, index) => ({
      id: question.id,
      question: index + 1,
      score: average(question.sections.map((section) => scoreOf.get(section.id) ?? 0)),
    }));
  }

  /** The plain average of the questions, whatever points the homework states, rounded and never below 1. */
  overall(questionScores: QuestionScore[]): number {
    return Math.max(1, Math.round(average(questionScores.map((question) => question.score))));
  }
}
