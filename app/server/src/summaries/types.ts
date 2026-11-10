export const MAX_OVERVIEW_WORDS = 300;
export const MAX_RECORDING_BYTES = 200 * 1024 * 1024;
/** A summary still in progress after this long is shown as failed, because the free server may have stopped. */
export const STALE_AFTER_MS = 15 * 60_000;

export interface SummaryParts {
  overview: string;
  topics: { title: string; start: string }[];
  questions: { time: string; question: string; answer: string }[];
  board: { time: string; content: string }[];
}

export interface GeneratedSummary {
  parts: SummaryParts;
  lessonTopic: string;
}

export interface Recording {
  path: string;
  mimeType: string;
}

export type SummaryStatus = "in_progress" | "ready" | "failed";

export interface SummaryState {
  status: SummaryStatus;
  startedAt: Date;
}

export interface SummaryLesson {
  teacherId: string;
  endsAt: Date;
}
