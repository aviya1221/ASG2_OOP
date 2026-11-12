import { createHash } from "node:crypto";
import { HttpError } from "../http/errors.ts";
import type { NotificationService } from "../notifications/NotificationService.ts";
import type { AttendanceRepository } from "./AttendanceRepository.ts";
import type { AttendanceRules } from "./AttendanceRules.ts";
import type { ClassFaceCache } from "./ClassFaceCache.ts";
import type { FaceMatcher } from "./FaceMatcher.ts";
import { MATCH_THRESHOLD, MAX_PHOTOS, SHARE_HOURS, type ClassFace, type FaceSpot, type PhotoFaces, type PhotoNumber, type RegistrationStatus, type Result, type Round, type SharedPhotoFile } from "./types.ts";

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
    // Saved before the result, so a failure here leaves no result and the phone can respond again.
    const seen = matcher.bestInEachPhoto(print, faces).filter((face) => face.score >= this.#threshold);
    await repository.saveSightings(lessonId, studentId, seen);
    return repository.recordMatch(lessonId, studentId, match);
  }

  /**
   * After the hour, the teacher shares the class photos with a number on each face that belongs to no
   * present student. The students who were not marked present are told they may pick their number.
   */
  async sharePhotos(lessonId: string, teacherId: string, files: SharedPhotoFile[], numbers: PhotoNumber[]): Promise<{ expiresAt: Date }> {
    const { repository, notifications } = this.#parts;
    const lesson = await repository.findLesson(lessonId);
    if (!lesson) throw new HttpError(404, "not_found", "There is no such lesson.");
    if (lesson.teacherId !== teacherId) throw new HttpError(403, "not_the_teacher", "Only the teacher of the lesson can do this.");

    const round = await repository.findRound(lessonId);
    if (!round) throw new HttpError(404, "no_round", "The class has not been photographed.");
    const now = this.#now();
    if (now < round.expiresAt) throw new HttpError(409, "round_open", "The photo can be shared only after the hour.");
    if (await repository.hasSharedPhotos(lessonId)) throw new HttpError(409, "already_shared", "The class photo of this lesson was already shared.");

    checkSharedPhotos(files, numbers);
    const identified = new Set((await repository.identifiedFaces(lessonId)).map(spotKey));
    if (numbers.some((item) => identified.has(spotKey(item)))) {
      throw new HttpError(400, "identified_face", "A number was drawn on the face of a present student.");
    }

    const expiresAt = new Date(now.getTime() + SHARE_HOURS * 3_600_000);
    await repository.saveSharedPhotos(lessonId, files, numbers, expiresAt);
    repository
      .studentsWhoMayPick(lessonId)
      .then((students) => notifications.notifyPhotoShared(students))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : "Sending notifications failed");
      });
    return { expiresAt };
  }

  /** Deletes the shared photos whose time is over, and answers how many were deleted. */
  async removeExpiredPhotos(): Promise<number> {
    const { repository } = this.#parts;
    const paths = await repository.expiredPhotoFiles(this.#now());
    await repository.removePhotoFiles(paths);
    return paths.length;
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

function spotKey(spot: FaceSpot): string {
  return `${spot.photoNo}:${spot.faceNo}`;
}

/** 1 to 3 photos, each once, and every number once, on a face of one of these photos. */
function checkSharedPhotos(files: SharedPhotoFile[], numbers: PhotoNumber[]): void {
  const photoNos = new Set(files.map((file) => file.photoNo));
  const validPhotos =
    files.length >= 1 &&
    files.length <= MAX_PHOTOS &&
    photoNos.size === files.length &&
    files.every((file) => Number.isInteger(file.photoNo) && file.photoNo >= 0 && file.photoNo < MAX_PHOTOS);
  if (!validPhotos) throw new HttpError(400, "bad_photos", `Send 1 to ${MAX_PHOTOS} photos, each once.`);

  const validNumbers =
    numbers.length >= 1 &&
    new Set(numbers.map((item) => item.number)).size === numbers.length &&
    new Set(numbers.map(spotKey)).size === numbers.length &&
    numbers.every(
      (item) =>
        Number.isInteger(item.number) &&
        item.number > 0 &&
        photoNos.has(item.photoNo) &&
        Number.isInteger(item.faceNo) &&
        item.faceNo >= 0 &&
        item.box.length === 4 &&
        item.box.every(Number.isInteger),
    );
  if (!validNumbers) throw new HttpError(400, "bad_numbers", "Each number needs a photo, a face and a box, and each appears once.");
}

function facesOf(photos: PhotoFaces[]): ClassFace[] {
  return photos.flatMap((photo, photoNo) => photo.faces.map((face, faceNo) => ({ photoNo, faceNo, print: face.print })));
}
