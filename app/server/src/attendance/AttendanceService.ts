import { HttpError } from "../http/errors.ts";
import type { NotificationService } from "../notifications/NotificationService.ts";
import type { AttendanceRepository } from "./AttendanceRepository.ts";
import type { AttendanceRules } from "./AttendanceRules.ts";
import { MAX_FACES, MAX_PHOTOS, SHARE_HOURS, type FaceSpot, type LessonInfo, type PhotoNumber, type Round, type SharedPhotoFile } from "./types.ts";

export interface AttendanceParts {
  repository: AttendanceRepository;
  rules: AttendanceRules;
  notifications: NotificationService;
  now?: () => Date;
}

/**
 * The logic of attendance on the server (docs/features/F1-attendance-strategy.md). The students' own
 * confirmations and picks go straight to the database, under its access rules.
 */
export class AttendanceService {
  readonly #parts: AttendanceParts;
  readonly #now: () => Date;

  constructor(parts: AttendanceParts) {
    this.#parts = parts;
    this.#now = parts.now ?? (() => new Date());
  }

  /** The teacher's phone counted the faces in the class photo. The time to confirm starts here. */
  async startRound(lessonId: string, teacherId: string, faceCount: number): Promise<Round> {
    const { repository, notifications } = this.#parts;
    const lesson = await this.#lessonOfTeacher(lessonId, teacherId);

    const now = this.#now();
    if (now < lesson.startsAt || now >= lesson.endsAt) throw new HttpError(403, "outside_lesson", "The lesson is not in progress.");
    if (!Number.isInteger(faceCount) || faceCount < 0 || faceCount > MAX_FACES) {
      throw new HttpError(400, "bad_count", `The face count must be a whole number from 0 to ${MAX_FACES}.`);
    }
    if (await repository.findRound(lessonId)) throw new HttpError(409, "round_exists", "The class of this lesson was already photographed.");

    const round = await repository.saveRound(lessonId, faceCount);
    notifications.notifyCourse(lessonId).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Sending notifications failed");
    });
    return round;
  }

  /**
   * When more students confirmed than there are faces, the teacher shares the class photo with a number
   * on every face, and the students who confirmed are told to pick their number.
   */
  async sharePhotos(lessonId: string, teacherId: string, files: SharedPhotoFile[], numbers: PhotoNumber[]): Promise<{ expiresAt: Date }> {
    const { repository, rules, notifications } = this.#parts;
    await this.#lessonOfTeacher(lessonId, teacherId);

    const round = await repository.findRound(lessonId);
    if (!round) throw new HttpError(404, "no_round", "The class has not been photographed.");
    const now = this.#now();
    if (now < round.expiresAt) throw new HttpError(409, "round_open", "The photo can be shared only after the time to confirm.");
    if (await repository.hasSharedPhotos(lessonId)) throw new HttpError(409, "already_shared", "The class photo of this lesson was already shared.");
    if (!rules.needsNumbers(await repository.confirmationCount(lessonId), round.faceCount)) {
      throw new HttpError(409, "no_need", "No more students confirmed than there are faces in the photo.");
    }
    checkSharedPhotos(files, numbers, round.faceCount);

    const expiresAt = new Date(now.getTime() + SHARE_HOURS * 3_600_000);
    await repository.saveSharedPhotos(lessonId, files, numbers, expiresAt);
    repository
      .confirmedStudents(lessonId)
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

  async #lessonOfTeacher(lessonId: string, teacherId: string): Promise<LessonInfo> {
    const lesson = await this.#parts.repository.findLesson(lessonId);
    if (!lesson) throw new HttpError(404, "not_found", "There is no such lesson.");
    if (lesson.teacherId !== teacherId) throw new HttpError(403, "not_the_teacher", "Only the teacher of the lesson can do this.");
    return lesson;
  }
}

function spotKey(spot: FaceSpot): string {
  return `${spot.photoNo}:${spot.faceNo}`;
}

/** The class photo once, and a number on every face of it: each face once, numbered from 1 with no gap. */
function checkSharedPhotos(files: SharedPhotoFile[], numbers: PhotoNumber[], faceCount: number): void {
  const photoNos = new Set(files.map((file) => file.photoNo));
  const validPhotos =
    files.length >= 1 &&
    files.length <= MAX_PHOTOS &&
    photoNos.size === files.length &&
    files.every((file) => Number.isInteger(file.photoNo) && file.photoNo >= 0 && file.photoNo < MAX_PHOTOS);
  if (!validPhotos) throw new HttpError(400, "bad_photos", "Send the class photo once.");

  const values = new Set(numbers.map((item) => item.number));
  const validNumbers =
    numbers.length === faceCount &&
    values.size === numbers.length &&
    new Set(numbers.map(spotKey)).size === numbers.length &&
    numbers.every(
      (item) =>
        Number.isInteger(item.number) &&
        item.number >= 1 &&
        item.number <= faceCount &&
        photoNos.has(item.photoNo) &&
        Number.isInteger(item.faceNo) &&
        item.faceNo >= 0 &&
        item.faceNo < faceCount &&
        item.box.length === 4 &&
        item.box.every(Number.isInteger),
    );
  if (!validNumbers) throw new HttpError(400, "bad_numbers", "Every face of the photo needs one number and a box, and each number appears once.");
}
