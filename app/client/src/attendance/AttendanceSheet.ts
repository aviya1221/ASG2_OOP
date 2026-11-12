import { supabase } from "../lib/supabase.ts";

export interface SheetRow {
  idNumber: string;
  name: string;
  attendance: string | null;
  decidedBy: string | null;
  /** The number the student picked in the shared class photo, and its state. */
  claimNumber: number | null;
  claimStatus: string | null;
  /** Another student's pick of the same number waits too. */
  claimContested: boolean;
  flagged: boolean;
}

export const RESULT_LABELS: Record<string, string> = {
  present: "נוכח",
  review: "לבדיקה",
  not_found: "לא נמצא",
  conflict: "התנגשות",
  no_response: "לא הגיב",
};

const DECIDED_LABELS: Record<string, string> = { face: "זיהוי פנים", photo_number: "מספר בתמונה" };
const FLAG_NOTE = "בחירה שנדחתה, או 3 בחירות ומעלה בקורס";
const HEADERS = ["תעודת זהות", "שם", "נוכחות", "איך הוחלט", "הערה"];
const COLUMN_WIDTHS = [14, 24, 12, 14, 36];

export async function loadSheet(lessonId: string): Promise<SheetRow[]> {
  const { data } = await supabase.from("attendance_sheet").select("*").eq("lesson_id", lessonId).order("id_number");
  return (data ?? []).map((row) => ({
    idNumber: row.id_number,
    name: row.name,
    attendance: row.attendance,
    decidedBy: row.decided_by,
    claimNumber: row.claim_number,
    claimStatus: row.claim_status,
    claimContested: row.claim_contested,
    flagged: row.flagged,
  }));
}

/** The rows of the file: every cell is text, so an ID number keeps its leading zero and nothing runs as a formula. */
export function sheetCells(rows: SheetRow[]): string[][] {
  return rows.map((row) => [
    row.idNumber,
    row.name,
    row.attendance ? (RESULT_LABELS[row.attendance] ?? row.attendance) : "",
    row.decidedBy ? (DECIDED_LABELS[row.decidedBy] ?? row.decidedBy) : "",
    row.flagged ? FLAG_NOTE : "",
  ]);
}

export async function downloadSheet(rows: SheetRow[], fileName: string): Promise<void> {
  // Loaded only here, so students do not download it with the page.
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const data = [
    HEADERS.map((value) => ({ value, fontWeight: "bold" as const })),
    ...sheetCells(rows).map((row) => row.map((value) => ({ type: String, value }))),
  ];
  await writeExcelFile(data, {
    sheet: "נוכחות",
    rightToLeft: true,
    stickyRowsCount: 1,
    columns: COLUMN_WIDTHS.map((width) => ({ width })),
  }).toFile(fileName);
}
