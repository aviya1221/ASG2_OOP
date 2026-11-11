import type { SummaryLesson, SummaryState } from "./types.ts";

export interface SummaryRepository {
  findLesson(lessonId: string): Promise<SummaryLesson | null>;
  findState(lessonId: string): Promise<SummaryState | null>;
  /** Sets the status to in progress and hides the summary from the class. The teacher keeps the earlier text until the new one is ready (REQ-73). */
  markStarted(lessonId: string): Promise<void>;
  saveReady(lessonId: string, body: string): Promise<void>;
  markFailed(lessonId: string): Promise<void>;
  setTopicIfEmpty(lessonId: string, topic: string): Promise<void>;
}
