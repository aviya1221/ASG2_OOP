/** The scores and the report of a check, as the server saves them (docs/07-EDD/homework-review.md, section 3). */
export interface SectionScore {
  id: string;
  question: number;
  section: number;
  score: number;
}

export interface QuestionScore {
  id: string;
  question: number;
  score: number;
}

export interface ReportSection extends SectionScore {
  answered: boolean;
  meets: string;
  missing: string;
  direction: string;
}

export interface Check {
  checkNumber: number;
  overall: number;
  questionScores: QuestionScore[];
  report: { sections: ReportSection[] };
}

/** One student's latest check in the class chart (REQ-57). */
export interface ChartRow {
  name: string;
  isMe: boolean;
  overall: number;
  questionScores: QuestionScore[];
  sectionScores: SectionScore[];
}

export const MAX_CHECKS = 3;

const LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";

export function questionLabel(question: number): string {
  return `שאלה ${question}`;
}

/** "שאלה 2, סעיף ב", or just "שאלה 2" when the question has one section. */
export function sectionLabel(section: SectionScore, all: SectionScore[]): string {
  const alone = all.filter((other) => other.question === section.question).length === 1;
  if (alone) return questionLabel(section.question);
  return `${questionLabel(section.question)}, סעיף ${LETTERS[section.section - 1] ?? section.section}`;
}

/** Question scores are averages, so they can have a fraction: 70.5. */
export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
