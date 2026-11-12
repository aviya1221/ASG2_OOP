import { RESULT_LABELS } from "./AttendanceSheet.ts";

/** An attendance result always shows its word, and its color only adds to it (UI decision 6). */
export function ResultChip({ kind }: { kind: string }) {
  return <span className={`chip result-${kind}`}>{RESULT_LABELS[kind] ?? kind}</span>;
}
