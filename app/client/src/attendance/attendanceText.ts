/** The sentences of the attendance tab that depend on numbers. */

function students(count: number): string {
  return count === 1 ? "סטודנט אחד אישר" : `${count} סטודנטים אישרו`;
}

function faces(count: number): string {
  if (count === 0) return "לא נמצא אף פרצוף";
  return count === 1 ? "נמצא פרצוף אחד" : `נמצאו ${count} פרצופים`;
}

/** What the teacher reads while students confirm. */
export function progressText(confirmations: number, faceCount: number): string {
  const who = confirmations === 0 ? "עוד אף סטודנט לא אישר" : `עד עכשיו ${students(confirmations)}`;
  return `${who}. בתמונה ${faces(faceCount)}.`;
}

/** What the teacher reads when the time to confirm ends: the confirmations against the faces in the photo. */
export function countText(confirmations: number, faceCount: number): string {
  if (confirmations === 0) return `אף סטודנט לא אישר. בתמונה ${faces(faceCount)}.`;
  if (confirmations <= faceCount) return `${students(confirmations)}, ובתמונה ${faces(faceCount)}. כל מי שאישר מסומן נוכח.`;
  const only = faceCount === 0 ? "לא נמצא אף פרצוף" : faceCount === 1 ? "נמצא רק פרצוף אחד" : `נמצאו רק ${faceCount} פרצופים`;
  return `${students(confirmations)}, אבל בתמונה ${only}. כל מי שאישר צריך לבחור את המספר שלו בתמונת הכיתה.`;
}

/** A student's pick in the shared photo. A pick with no number says "I am not in the photo". */
export interface Claim {
  number: number | null;
  status: string;
  contested: boolean;
}

export function claimTitle(claim: Claim): string {
  return claim.number === null ? "ביקשת לסמן שאינך מופיע בתמונה" : `בחרת את מספר ${claim.number}`;
}

/** A number only one student picked counts at once; two picks of one number wait for the teacher together. */
export function claimText(claim: Claim): string {
  if (claim.status === "approved") return "אושר";
  if (claim.status === "rejected") return "נדחה";
  if (claim.number === null) return "ממתין להחלטת המרצה";
  return claim.contested ? "הועבר למרצה להמשך טיפול" : "נקלט";
}
