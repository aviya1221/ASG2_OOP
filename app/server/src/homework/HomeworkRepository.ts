import type { Homework, HomeworkCheck, HomeworkLesson, ReviewGuide } from "./types.ts";

export interface HomeworkRepository {
  findLesson(lessonId: string): Promise<HomeworkLesson | null>;
  /** Stores the PDF, the homework and its guide together, or none of them. */
  saveHomework(lessonId: string, title: string, pdf: Uint8Array, guide: ReviewGuide): Promise<Homework>;
  findHomework(homeworkId: string): Promise<Homework | null>;
  /** Deletes the homework with its guide and checks, and then its PDF (REQ-74). */
  deleteHomework(homework: Homework): Promise<void>;
  studiesLesson(lessonId: string, studentId: string): Promise<boolean>;
  findGuide(homeworkId: string): Promise<ReviewGuide | null>;
  /** Counts saved checks only, so a check that failed is not counted (REQ-56). */
  countChecks(homeworkId: string, studentId: string): Promise<number>;
  /** False when a check with the same number was saved first, by a request sent at the same time. */
  saveCheck(check: HomeworkCheck): Promise<boolean>;
}
