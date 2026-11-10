import type { SummaryLesson, SummaryParts, SummaryState } from "./types.ts";

export interface SummaryRepository {
  findLesson(lessonId: string): Promise<SummaryLesson | null>;
  findState(lessonId: string): Promise<SummaryState | null>;
  /** Sets the status to in progress and keeps any earlier text until the new summary is ready. */
  markStarted(lessonId: string): Promise<void>;
  saveReady(lessonId: string, parts: SummaryParts): Promise<void>;
  markFailed(lessonId: string): Promise<void>;
  setTopicIfEmpty(lessonId: string, topic: string): Promise<void>;
}
