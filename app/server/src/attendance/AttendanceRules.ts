/**
 * The check when the time to confirm ends (docs/features/F1-attendance-strategy.md): more confirmations
 * than faces in the class photo means someone confirmed without being in the hall, so every student
 * who confirmed must pick their own number in the photo.
 */
export class AttendanceRules {
  needsNumbers(confirmations: number, faces: number): boolean {
    return confirmations > faces;
  }
}
