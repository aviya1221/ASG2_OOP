export const PRINT_LENGTH = 128;
export const MATCH_THRESHOLD = 0.36;
export const MAX_PHOTOS = 3;

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
