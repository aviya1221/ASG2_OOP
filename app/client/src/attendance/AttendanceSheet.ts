import { supabase } from "../lib/supabase.ts";

export interface SheetRow {
  /** The internal id, used only to point to the student. No screen shows it. */
  studentId: string;
  email: string;
  name: string;
  attendance: string;
  decidedBy: string | null;
  confirmed: boolean;
  /** The teacher set this result by hand. */
  changedByTeacher: boolean;
  /** The number the student picked in the shared class photo, or null for "I am not in the photo", and its state. */
  claimNumber: number | null;
  claimStatus: string | null;
  /** Another student's pick of the same number waits too. */
  claimContested: boolean;
  flagged: boolean;
}

export const RESULT_LABELS: Record<string, string> = {
  present: "נוכח",
  absent: "לא נוכח",
  pending: "ממתין",
  confirmed: "אישר",
  waiting: "עוד לא אישר",
  no_photo: "לא צולם",
};

const DECIDED_LABELS: Record<string, string> = { confirmation: "אישור עצמי", photo_number: "מספר בתמונה", teacher: "החלטת המרצה" };
const FLAG_NOTE = "בחירת מספר שנדחתה בקורס";
const HEADERS = ["אימייל", "שם", "נוכחות", "איך הוחלט", "הערה"];
const COLUMN_WIDTHS = [30, 24, 12, 14, 24];

export async function loadSheet(lessonId: string): Promise<SheetRow[]> {
  const { data } = await supabase.from("attendance_sheet").select("*").eq("lesson_id", lessonId).order("name");
  return (data ?? []).map((row) => ({
    studentId: row.student_id,
    email: row.email,
    name: row.name,
    attendance: row.attendance,
    decidedBy: row.decided_by,
    confirmed: row.confirmed,
    changedByTeacher: row.changed_by_teacher,
    claimNumber: row.claim_number,
    claimStatus: row.claim_status,
    claimContested: row.claim_contested,
    flagged: row.flagged,
  }));
}

/** The rows of the file: every cell is text, so nothing in a name or an email runs as a formula. */
export function sheetCells(rows: SheetRow[]): string[][] {
  return rows.map((row) => [
    row.email,
    row.name,
    RESULT_LABELS[row.attendance] ?? row.attendance,
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
