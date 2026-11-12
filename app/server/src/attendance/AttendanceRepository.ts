import type { ClassFace, FaceMatch, LessonInfo, PhotoFaces, Registration, Result, Round } from "./types.ts";

/** Everything attendance reads and writes. The server holds the secret key, so this may touch closed tables. */
export interface AttendanceRepository {
  findLesson(lessonId: string): Promise<LessonInfo | null>;
  isStudentOf(courseId: string, studentId: string): Promise<boolean>;
  saveRound(lessonId: string, photos: PhotoFaces[]): Promise<Round>;
  findRound(lessonId: string): Promise<Round | null>;
  loadFaces(lessonId: string): Promise<ClassFace[]>;
  findRegistration(studentId: string): Promise<Registration | null>;
  saveRegistration(studentId: string, hash: string | null, optedOut: boolean): Promise<void>;
  addReplacement(studentId: string, hash: string): Promise<void>;
  findResult(lessonId: string, studentId: string): Promise<Result | null>;
  saveResult(lessonId: string, studentId: string, result: Result): Promise<void>;
  recordMatch(lessonId: string, studentId: string, match: FaceMatch): Promise<Result>;
  /** Where a matched student was seen, one face in each photo. */
  saveSightings(lessonId: string, studentId: string, faces: FaceMatch[]): Promise<void>;
}
