import { isValidIdNumber } from "../accounts/identity.ts";

export interface Slot {
  day: number;
  start: string;
  end: string;
}

export interface StudentEntry {
  id_number: string;
  name: string;
}

export interface CourseForm {
  number: string;
  name: string;
  teacherId: string;
  teacherName: string;
  slots: Slot[];
  firstDate: string;
  weeks: string;
  students: string;
}

export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const DEFAULT_WEEKS = "13";

/** One student per line: the ID number, then the name, separated by a space, a comma or a tab. */
export function parseStudents(text: string): { students: StudentEntry[]; badLines: string[] } {
  const students: StudentEntry[] = [];
  const badLines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(\S+?)[\s,]+(.+)$/.exec(line);
    if (match && isValidIdNumber(match[1]!)) {
      students.push({ id_number: match[1]!, name: match[2]!.trim() });
    } else {
      badLines.push(line);
    }
  }
  return { students, badLines };
}

/** Everything that has to be fixed before the form can be saved (UC-07, 1a). */
export function problemsIn(form: CourseForm): string[] {
  const problems: string[] = [];
  if (!form.number.trim()) problems.push("חסר מספר קורס.");
  if (!form.name.trim()) problems.push("חסר שם קורס.");
  if (!isValidIdNumber(form.teacherId)) problems.push("תעודת הזהות של המרצה צריכה להכיל 5 עד 9 ספרות.");
  if (!form.teacherName.trim()) problems.push("חסר שם מרצה.");
  if (form.slots.length === 0) problems.push("חסרות שעות שבועיות.");
  if (form.slots.some((slot) => !slot.start || !slot.end || slot.start >= slot.end)) {
    problems.push("שעת הסיום צריכה להיות אחרי שעת ההתחלה.");
  }
  if (!form.firstDate) problems.push("חסר תאריך התחלה.");
  if (!(Number.isInteger(Number(form.weeks)) && Number(form.weeks) >= 1)) problems.push("מספר השבועות צריך להיות לפחות 1.");

  const { students, badLines } = parseStudents(form.students);
  if (students.length === 0) problems.push("חסרה רשימת סטודנטים.");
  for (const line of badLines) problems.push(`שורה לא תקינה ברשימת הסטודנטים: ${line}`);
  return problems;
}

const SAVE_ERRORS: Record<string, string> = {
  course_number_exists: "מספר הקורס הזה כבר קיים.",
  not_admin: "רק מנהל המערכת יכול לשנות את מערכת השעות.",
  missing_number: "חסר מספר קורס.",
  missing_name: "חסר שם קורס.",
  missing_teacher: "חסרים פרטי מרצה.",
  missing_hours: "חסרות שעות שבועיות.",
  missing_dates: "חסר תאריך התחלה או מספר שבועות.",
  missing_students: "חסרה רשימת סטודנטים.",
};

export function saveErrorMessage(code: string): string {
  return SAVE_ERRORS[code] ?? "השמירה נכשלה. כדאי לנסות שוב.";
}
