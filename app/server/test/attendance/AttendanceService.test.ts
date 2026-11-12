import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { AttendanceRepository } from "../../src/attendance/AttendanceRepository.ts";
import { AttendanceRules } from "../../src/attendance/AttendanceRules.ts";
import { AttendanceService } from "../../src/attendance/AttendanceService.ts";
import type { LessonInfo, PhotoNumber, Round, SharedPhotoFile } from "../../src/attendance/types.ts";
import { NotificationService } from "../../src/notifications/NotificationService.ts";

const NOW = new Date("2026-12-01T10:00:00Z");
const FOUR_MINUTES = 4 * 60_000;
const LESSON: LessonInfo = {
  id: "L1",
  courseId: "A",
  teacherId: "T1",
  startsAt: new Date("2026-12-01T09:00:00Z"),
  endsAt: new Date("2026-12-01T11:00:00Z"),
};

class FakeRepository implements AttendanceRepository {
  lesson: LessonInfo | null = LESSON;
  round: Round | null = null;
  savedCounts: number[] = [];
  confirmed = ["S1", "S2", "S3"];
  shared: { files: SharedPhotoFile[]; numbers: PhotoNumber[]; expiresAt: Date } | null = null;
  expired = ["L0/0-a.jpg"];
  removed: string[] = [];

  async findLesson() {
    return this.lesson;
  }
  async saveRound(lessonId: string, faceCount: number) {
    this.savedCounts.push(faceCount);
    return { lessonId, faceCount, expiresAt: new Date(NOW.getTime() + FOUR_MINUTES) };
  }
  async findRound() {
    return this.round;
  }
  async confirmationCount() {
    return this.confirmed.length;
  }
  async confirmedStudents() {
    return this.confirmed;
  }
  async hasSharedPhotos() {
    return this.shared !== null;
  }
  async saveSharedPhotos(_lesson: string, files: SharedPhotoFile[], numbers: PhotoNumber[], expiresAt: Date) {
    this.shared = { files, numbers, expiresAt };
  }
  async expiredPhotoFiles() {
    return this.expired;
  }
  async removePhotoFiles(paths: string[]) {
    this.removed.push(...paths);
  }
}

let repository: FakeRepository;
let service: AttendanceService;
let notified: string[];
let toldToPick: string[][];

beforeEach(() => {
  repository = new FakeRepository();
  notified = [];
  toldToPick = [];
  const notifications = new NotificationService(
    { saveSubscription: async () => {}, subscriptionsOfLesson: async () => [], subscriptionsOfStudents: async () => [], deleteSubscription: async () => {} },
    { send: async () => 201 },
  );
  notifications.notifyCourse = async (lessonId: string) => {
    notified.push(lessonId);
  };
  notifications.notifyPhotoShared = async (students: string[]) => {
    toldToPick.push(students);
  };
  service = new AttendanceService({ repository, rules: new AttendanceRules(), notifications, now: () => NOW });
});

describe("AttendanceService.startRound", () => {
  it("TC-014 saves only the face count, and notifies the course", async () => {
    const round = await service.startRound("L1", "T1", 41);
    assert.deepEqual(repository.savedCounts, [41]);
    assert.equal(round.expiresAt.getTime() - NOW.getTime(), FOUR_MINUTES);
    assert.deepEqual(notified, ["L1"]);
  });

  it("TC-015 refuses another teacher, a time outside the lesson, and a second photo", async () => {
    await assert.rejects(service.startRound("L1", "T2", 3), { status: 403, code: "not_the_teacher" });

    repository.lesson = { ...LESSON, endsAt: new Date(NOW.getTime() - 1) };
    await assert.rejects(service.startRound("L1", "T1", 3), { status: 403, code: "outside_lesson" });

    repository.lesson = LESSON;
    repository.round = { lessonId: "L1", faceCount: 3, expiresAt: NOW };
    await assert.rejects(service.startRound("L1", "T1", 3), { status: 409, code: "round_exists" });
    assert.deepEqual(repository.savedCounts, []);
  });

  it("refuses a face count that is not a whole number from 0 to 500", async () => {
    for (const count of [-1, 2.5, 501, Number.NaN]) {
      await assert.rejects(service.startRound("L1", "T1", count), { status: 400, code: "bad_count" });
    }
    await service.startRound("L1", "T1", 0);
    assert.deepEqual(repository.savedCounts, [0]);
  });
});

describe("AttendanceService.sharePhotos", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff]);
  const FILES: SharedPhotoFile[] = [{ photoNo: 0, jpeg: JPEG }];
  const NUMBERS: PhotoNumber[] = [
    { number: 1, photoNo: 0, faceNo: 1, box: [10, 10, 40, 40] },
    { number: 2, photoNo: 0, faceNo: 0, box: [90, 10, 40, 40] },
  ];

  beforeEach(() => {
    // Two faces and three confirmations, after the time to confirm.
    repository.round = { lessonId: "L1", faceCount: 2, expiresAt: new Date(NOW.getTime() - 1) };
  });

  it("saves the photo for 24 hours and tells the students who confirmed", async () => {
    const { expiresAt } = await service.sharePhotos("L1", "T1", FILES, NUMBERS);
    assert.equal(expiresAt.getTime() - NOW.getTime(), 24 * 3_600_000);
    assert.deepEqual(repository.shared?.numbers, NUMBERS);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(toldToPick, [["S1", "S2", "S3"]]);
  });

  it("refuses another teacher, a share within the 4 minutes, no photo, and a second share", async () => {
    await assert.rejects(service.sharePhotos("L1", "T2", FILES, NUMBERS), { status: 403, code: "not_the_teacher" });

    repository.round = { lessonId: "L1", faceCount: 2, expiresAt: new Date(NOW.getTime() + 1) };
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 409, code: "round_open" });

    repository.round = null;
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 404, code: "no_round" });

    repository.round = { lessonId: "L1", faceCount: 2, expiresAt: new Date(NOW.getTime() - 1) };
    await service.sharePhotos("L1", "T1", FILES, NUMBERS);
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 409, code: "already_shared" });
  });

  it("refuses to share when no more students confirmed than there are faces", async () => {
    repository.confirmed = ["S1", "S2"];
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 409, code: "no_need" });
    assert.equal(repository.shared, null);
  });

  it("shares a photo with no face, so a student can say they are not in it", async () => {
    repository.round = { lessonId: "L1", faceCount: 0, expiresAt: new Date(NOW.getTime() - 1) };
    await service.sharePhotos("L1", "T1", FILES, []);
    assert.deepEqual(repository.shared?.numbers, []);
  });

  it("refuses a photo and numbers that do not fit each other", async () => {
    const refused: [SharedPhotoFile[], PhotoNumber[], string][] = [
      [[], NUMBERS, "bad_photos"],
      [[...FILES, ...FILES], NUMBERS, "bad_photos"],
      [[{ photoNo: 1, jpeg: JPEG }], NUMBERS, "bad_photos"],
      [FILES, [NUMBERS[0]!], "bad_numbers"],
      [FILES, [...NUMBERS, { number: 3, photoNo: 0, faceNo: 2, box: [1, 2, 3, 4] }], "bad_numbers"],
      [FILES, [NUMBERS[0]!, { ...NUMBERS[1]!, number: 1 }], "bad_numbers"],
      [FILES, [NUMBERS[0]!, { ...NUMBERS[1]!, faceNo: 1 }], "bad_numbers"],
      [FILES, [NUMBERS[0]!, { ...NUMBERS[1]!, number: 3 }], "bad_numbers"],
      [FILES, [NUMBERS[0]!, { ...NUMBERS[1]!, faceNo: 2 }], "bad_numbers"],
      [FILES, [{ ...NUMBERS[0]!, photoNo: 1 }, NUMBERS[1]!], "bad_numbers"],
      [FILES, [{ ...NUMBERS[0]!, box: [1, 2, 3] }, NUMBERS[1]!], "bad_numbers"],
    ];
    for (const [files, numbers, code] of refused) {
      await assert.rejects(service.sharePhotos("L1", "T1", files, numbers), { status: 400, code });
    }
    assert.equal(repository.shared, null);
  });
});

describe("AttendanceService.removeExpiredPhotos", () => {
  it("deletes the files whose time is over", async () => {
    assert.equal(await service.removeExpiredPhotos(), 1);
    assert.deepEqual(repository.removed, ["L0/0-a.jpg"]);
  });
});
