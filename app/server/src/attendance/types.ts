export const PRINT_LENGTH = 128;
export const MATCH_THRESHOLD = 0.36;
export const MAX_PHOTOS = 3;
/** How long students may pick their number in a shared class photo. */
export const SHARE_HOURS = 24;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const JPEG = "image/jpeg";

export type Result = "present" | "review" | "not_found" | "conflict";
export type Decision = "review" | "not_found" | "matched";
export type RegistrationStatus = "registered" | "opted_out" | "waiting_for_teacher";

export interface ClassFace {
  photoNo: number;
  faceNo: number;
  print: ArrayLike<number>;
}

export interface FaceMatch {
  photoNo: number;
  faceNo: number;
  score: number;
}

/** A photo as the teacher's phone sends it: only positions and face-prints. */
export interface PhotoFaces {
  faces: { box: number[]; print: number[] }[];
}

/** One face in one photo of the round. */
export interface FaceSpot {
  photoNo: number;
  faceNo: number;
}

/** A number the teacher's phone drew on a face that belongs to no present student. */
export interface PhotoNumber extends FaceSpot {
  number: number;
  box: number[];
}

/** A class photo the teacher shares, with the numbers already drawn on it. */
export interface SharedPhotoFile {
  photoNo: number;
  jpeg: Uint8Array;
}

export interface Round {
  lessonId: string;
  expiresAt: Date;
}

export interface LessonInfo {
  id: string;
  courseId: string;
  teacherId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface Registration {
  hash: string | null;
  optedOut: boolean;
}
