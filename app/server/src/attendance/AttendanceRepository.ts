import type { LessonInfo, PhotoNumber, Round, SharedPhotoFile } from "./types.ts";

/** Everything attendance reads and writes. The server holds the secret key, so this may touch closed tables. */
export interface AttendanceRepository {
  findLesson(lessonId: string): Promise<LessonInfo | null>;
  saveRound(lessonId: string, faceCount: number): Promise<Round>;
  findRound(lessonId: string): Promise<Round | null>;
  /** How many students confirmed they were in the lesson. */
  confirmationCount(lessonId: string): Promise<number>;
  /** The students who confirmed they were in the lesson. */
  confirmedStudents(lessonId: string): Promise<string[]>;
  hasSharedPhotos(lessonId: string): Promise<boolean>;
  saveSharedPhotos(lessonId: string, files: SharedPhotoFile[], numbers: PhotoNumber[], expiresAt: Date): Promise<void>;
  expiredPhotoFiles(now: Date): Promise<string[]>;
  removePhotoFiles(paths: string[]): Promise<void>;
}
