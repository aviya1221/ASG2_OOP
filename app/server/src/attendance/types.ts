/** One class photo per lesson: with no face recognition, a person in two photos would be counted twice. */
export const MAX_PHOTOS = 1;
/** More faces than this in one photo is not a class. */
export const MAX_FACES = 500;
/** How long students may pick their number in a shared class photo. */
export const SHARE_HOURS = 24;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const JPEG = "image/jpeg";

/** One face in the class photo. */
export interface FaceSpot {
  photoNo: number;
  faceNo: number;
}

/** A number the teacher's phone drew on a face of the class photo. */
export interface PhotoNumber extends FaceSpot {
  number: number;
  box: number[];
}

/** A class photo the teacher shares, with the numbers already drawn on it. */
export interface SharedPhotoFile {
  photoNo: number;
  jpeg: Uint8Array;
}

/** The class photo of a lesson: how many faces it holds, and when the time to confirm ends. */
export interface Round {
  lessonId: string;
  faceCount: number;
  expiresAt: Date;
}

export interface LessonInfo {
  id: string;
  courseId: string;
  teacherId: string;
  startsAt: Date;
  endsAt: Date;
}
