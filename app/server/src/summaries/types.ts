/** About one printed page with its headings (REQ-45). */
export const MAX_SUMMARY_WORDS = 450;
export const MAX_RECORDING_BYTES = 200 * 1024 * 1024;
/** A summary still in progress after this long is shown as failed, because the free server may have stopped. */
export const STALE_AFTER_MS = 15 * 60_000;

export interface GeneratedSummary {
  /** The one-page summary in Markdown: headings, short points and bold key terms. */
  body: string;
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
