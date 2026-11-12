import type { ClassFace, FaceMatch, FaceSpot, LessonInfo, PhotoFaces, PhotoNumber, Registration, Result, Round, SharedPhotoFile } from "./types.ts";

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
  /** The faces that belong to a present student, in every photo they were seen in. */
  identifiedFaces(lessonId: string): Promise<FaceSpot[]>;
  hasSharedPhotos(lessonId: string): Promise<boolean>;
  saveSharedPhotos(lessonId: string, files: SharedPhotoFile[], numbers: PhotoNumber[], expiresAt: Date): Promise<void>;
  /** The students of the course whom the face check did not mark present. */
  studentsWhoMayPick(lessonId: string): Promise<string[]>;
  expiredPhotoFiles(now: Date): Promise<string[]>;
  removePhotoFiles(paths: string[]): Promise<void>;
}
