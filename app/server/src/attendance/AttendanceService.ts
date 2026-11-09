import { createHash } from "node:crypto";
import { HttpError } from "../http/errors.ts";
import type { NotificationService } from "../notifications/NotificationService.ts";
import type { AttendanceRepository } from "./AttendanceRepository.ts";
import type { AttendanceRules } from "./AttendanceRules.ts";
import type { ClassFaceCache } from "./ClassFaceCache.ts";
import type { FaceMatcher } from "./FaceMatcher.ts";
import { MATCH_THRESHOLD, MAX_PHOTOS, type ClassFace, type PhotoFaces, type RegistrationStatus, type Result, type Round } from "./types.ts";

export interface AttendanceParts {
  repository: AttendanceRepository;
  cache: ClassFaceCache;
  matcher: FaceMatcher;
  rules: AttendanceRules;
  notifications: NotificationService;
  now?: () => Date;
}

export function hashOfPrint(print: Float32Array): string {
  return createHash("sha256").update(new Uint8Array(print.buffer, print.byteOffset, print.byteLength)).digest("hex");
}

/** The logic of attendance on the server (docs/07-EDD/attendance.md). */
export class AttendanceService {
  readonly #parts: AttendanceParts;
  readonly #now: () => Date;
  readonly #threshold = MATCH_THRESHOLD;

  constructor(parts: AttendanceParts) {
    this.#parts = parts;
    this.#now = parts.now ?? (() => new Date());
  }

  async registerFace(studentId: string, hash: string | null, optOut: boolean): Promise<RegistrationStatus> {
    const { repository } = this.#parts;
    if (optOut) {
      await repository.saveRegistration(studentId, null, true);
      return "opted_out";
    }
    const current = await repository.findRegistration(studentId);
    if (current?.hash) {
      await repository.addReplacement(studentId, hash!);
      return "waiting_for_teacher";
    }
    await repository.saveRegistration(studentId, hash, false);
    return "registered";
  }

  async startRound(lessonId: string, teacherId: string, photos: PhotoFaces[]): Promise<Round> {
    const { repository, cache, notifications } = this.#parts;
    const lesson = await repository.findLesson(lessonId);
    if (!lesson) throw new HttpError(404, "not_found", "There is no such lesson.");
    if (lesson.teacherId !== teacherId) throw new HttpError(403, "not_the_teacher", "Only the teacher of the lesson can do this.");

    const now = this.#now();
    if (now < lesson.startsAt || now >= lesson.endsAt) throw new HttpError(403, "outside_lesson", "The lesson is not in progress.");
    if (photos.length < 1 || photos.length > MAX_PHOTOS) throw new HttpError(400, "bad_photos", `Send 1 to ${MAX_PHOTOS} photos.`);
    if (await repository.findRound(lessonId)) throw new HttpError(409, "round_exists", "The photos of this lesson were already sent.");

    const round = await repository.saveRound(lessonId, photos);
    cache.put(lessonId, facesOf(photos), round.expiresAt);
    notifications.notifyCourse(lessonId).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Sending notifications failed");
    });
    return round;
  }

  /** The face-print is overwritten before this returns, whatever the outcome (NFR-09). */
  async respond(lessonId: string, studentId: string, print: Float32Array, hash: string): Promise<Result> {
    try {
      return await this.#respond(lessonId, studentId, print, hash);
    } finally {
      print.fill(0);
    }
  }

  async #respond(lessonId: string, studentId: string, print: Float32Array, hash: string): Promise<Result> {
    const { repository, matcher, rules } = this.#parts;
    const lesson = await repository.findLesson(lessonId);
    if (!lesson) throw new HttpError(404, "not_found", "There is no such lesson.");
    if (!(await repository.isStudentOf(lesson.courseId, studentId))) {
      throw new HttpError(403, "not_in_course", "This lesson is not of your course.");
    }

    const round = await repository.findRound(lessonId);
    if (!round) throw new HttpError(404, "no_round", "The class has not been photographed.");

    const saved = await repository.findResult(lessonId, studentId);
    if (saved) return saved;
    if (this.#now() >= round.expiresAt) throw new HttpError(409, "round_closed", "The hour for responding is over.");

    const registration = await repository.findRegistration(studentId);
    const hashFits = Boolean(registration?.hash) && registration!.hash === hash && hashOfPrint(print) === hash;
    if (!hashFits) {
      await repository.saveResult(lessonId, studentId, "review");
      return "review";
    }

    const faces = await this.#facesOf(round);
    const match = matcher.best(print, faces);
    const decision = rules.decide(true, match?.score ?? -1, this.#threshold);
    if (decision !== "matched" || !match) {
      await repository.saveResult(lessonId, studentId, "not_found");
      return "not_found";
    }
    return repository.recordMatch(lessonId, studentId, match);
  }

  async #facesOf(round: Round): Promise<ClassFace[]> {
    const { repository, cache } = this.#parts;
    const cached = cache.get(round.lessonId);
    if (cached) return cached;
    const faces = await repository.loadFaces(round.lessonId);
    cache.put(round.lessonId, faces, round.expiresAt);
    return faces;
  }
}

function facesOf(photos: PhotoFaces[]): ClassFace[] {
  return photos.flatMap((photo, photoNo) => photo.faces.map((face, faceNo) => ({ photoNo, faceNo, print: face.print })));
}
