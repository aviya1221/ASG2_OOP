/** About one printed page with its headings (REQ-45). The server holds the same limit. */
export const MAX_SUMMARY_WORDS = 450;

export const STALE_AFTER_MS = 15 * 60_000;

/** A summary in progress for more than 15 minutes is shown as failed: the free server may have stopped. */
export function isStale(startedAt: Date, now: Date): boolean {
  return now.getTime() - startedAt.getTime() > STALE_AFTER_MS;
}

/** Counts the words a reader sees: the marks of headings, points and bold text are not words. */
export function summaryWords(markdown: string): number {
  return markdown
    .replace(/^\s*(#{1,6}|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
