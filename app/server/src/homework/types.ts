/** Settings of the homework review (docs/07-EDD/homework-review.md, section 6). */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_CHECKS = 3;
/** The fixed seed of ADR-9. A retry adds SEED_STEP, because the same seed returns the same answer. */
export const REVIEW_SEED = 20261109;
export const SEED_STEP = 7;
export const PDF = "application/pdf";

/** One section of the review guide. `expected` holds the answer, so the guide never reaches the page. */
export interface GuideSection {
  id: string;
  asked: string;
  requirements: string[];
  expected: string;
  score_bands: string;
  giving_away: string;
}

export interface GuideQuestion {
  id: string;
  title: string;
  sections: GuideSection[];
}

/** Made once per homework and used unchanged by every check (REQ-51). */
export interface ReviewGuide {
  questions: GuideQuestion[];
  system_prompt: string;
}

/** The model's mark of one section, after the server's check. */
export interface SectionMark {
  id: string;
  evidence: string;
  answered: boolean;
  score: number;
  meets: string;
  missing: string;
  direction: string;
}

/** Where a section sits in the homework, counted from 1: question 2, section 1. */
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

/** What the student reads about one section (REQ-53). */
export interface ReportSection extends SectionScore {
  answered: boolean;
  meets: string;
  missing: string;
  direction: string;
}

export interface Homework {
  id: string;
  lessonId: string;
  title: string;
  filePath: string;
}

export interface HomeworkLesson {
  teacherId: string;
}

/** A saved check holds no part of the solution file (REQ-59). The database adds the time. */
export interface HomeworkCheck {
  homeworkId: string;
  studentId: string;
  checkNumber: number;
  sectionScores: SectionScore[];
  questionScores: QuestionScore[];
  overall: number;
  report: { sections: ReportSection[] };
}
