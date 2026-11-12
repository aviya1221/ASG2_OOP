import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { AttendanceRepository } from "../../src/attendance/AttendanceRepository.ts";
import { AttendanceRules } from "../../src/attendance/AttendanceRules.ts";
import { AttendanceService, hashOfPrint } from "../../src/attendance/AttendanceService.ts";
import { ClassFaceCache } from "../../src/attendance/ClassFaceCache.ts";
import { FaceMatcher } from "../../src/attendance/FaceMatcher.ts";
import type { ClassFace, FaceMatch, FaceSpot, LessonInfo, PhotoFaces, PhotoNumber, Registration, Result, Round, SharedPhotoFile } from "../../src/attendance/types.ts";
import { NotificationService } from "../../src/notifications/NotificationService.ts";

const NOW = new Date("2026-12-01T10:00:00Z");
const LESSON: LessonInfo = {
  id: "L1",
  courseId: "A",
  teacherId: "T1",
  startsAt: new Date("2026-12-01T09:00:00Z"),
  endsAt: new Date("2026-12-01T11:00:00Z"),
};

function printOf(...first: number[]): Float32Array {
  const print = new Float32Array(128);
  print.set(first);
  return print;
}

class FakeRepository implements AttendanceRepository {
  lesson: LessonInfo | null = LESSON;
  round: Round | null = { lessonId: "L1", expiresAt: new Date(NOW.getTime() + 3_600_000) };
  faces: ClassFace[] = [];
  registrations = new Map<string, Registration>();
  results = new Map<string, Result>();
  replacements: string[] = [];
  loadFacesCalls = 0;
  saveRoundCalls = 0;
  matches: FaceMatch[] = [];
  sightings = new Map<string, FaceMatch[]>();
  identified: FaceSpot[] = [];
  shared: { files: SharedPhotoFile[]; numbers: PhotoNumber[]; expiresAt: Date } | null = null;
  mayPick = ["S2", "S3"];
  expired = ["L0/0-a.jpg"];
  removed: string[] = [];

  async findLesson() {
    return this.lesson;
  }
  async isStudentOf(_course: string, student: string) {
    return student !== "S51";
  }
  async saveRound(lessonId: string, _photos: PhotoFaces[]) {
    this.saveRoundCalls += 1;
    return { lessonId, expiresAt: new Date(NOW.getTime() + 3_600_000) };
  }
  async findRound() {
    return this.round;
  }
  async loadFaces() {
    this.loadFacesCalls += 1;
    return this.faces;
  }
  async findRegistration(student: string) {
    return this.registrations.get(student) ?? null;
  }
  async saveRegistration(student: string, hash: string | null, optedOut: boolean) {
    this.registrations.set(student, { hash, optedOut });
  }
  async addReplacement(_student: string, hash: string) {
    this.replacements.push(hash);
  }
  async findResult(_lesson: string, student: string) {
    return this.results.get(student) ?? null;
  }
  async saveResult(_lesson: string, student: string, result: Result) {
    this.results.set(student, result);
  }
  async recordMatch(_lesson: string, student: string, match: FaceMatch): Promise<Result> {
    this.matches.push(match);
    this.results.set(student, "present");
    return "present";
  }
  async saveSightings(_lesson: string, student: string, faces: FaceMatch[]) {
    this.sightings.set(student, faces);
  }
  async identifiedFaces() {
    return this.identified;
  }
  async hasSharedPhotos() {
    return this.shared !== null;
  }
  async saveSharedPhotos(_lesson: string, files: SharedPhotoFile[], numbers: PhotoNumber[], expiresAt: Date) {
    this.shared = { files, numbers, expiresAt };
  }
  async studentsWhoMayPick() {
    return this.mayPick;
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
  service = new AttendanceService({
    repository,
    cache: new ClassFaceCache(() => NOW.getTime()),
    matcher: new FaceMatcher(),
    rules: new AttendanceRules(),
    notifications,
    now: () => NOW,
  });
});

function register(student: string, print: Float32Array): string {
  const hash = hashOfPrint(print);
  repository.registrations.set(student, { hash, optedOut: false });
  return hash;
}

const PHOTOS: PhotoFaces[] = [{ faces: [{ box: [1, 2, 3, 4], print: Array.from(printOf(1)) }] }];

describe("AttendanceService.respond", () => {
  it("TC-018 a face-print that does not fit the hash gives review, with no comparison", async () => {
    const print = printOf(1, 0);
    register("S1", printOf(0, 1));
    const result = await service.respond("L1", "S1", print, hashOfPrint(printOf(0, 1)));
    assert.equal(result, "review");
    assert.equal(repository.loadFacesCalls, 0);
    assert.equal(repository.results.get("S1"), "review");
  });

  it("TC-018 a best score below the threshold gives not_found", async () => {
    const print = printOf(1, 0);
    const hash = register("S1", print);
    repository.faces = [{ photoNo: 0, faceNo: 0, print: Array.from(printOf(0.35, Math.sqrt(1 - 0.35 * 0.35))) }];
    assert.equal(await service.respond("L1", "S1", print, hash), "not_found");
  });

  it("TC-018 a best score at the threshold is a match", async () => {
    const print = printOf(1, 0);
    const hash = register("S1", print);
    repository.faces = [{ photoNo: 0, faceNo: 3, print: Array.from(printOf(0.37, Math.sqrt(1 - 0.37 * 0.37))) }];
    assert.equal(await service.respond("L1", "S1", print, hash), "present");
    assert.equal(repository.matches[0]?.faceNo, 3);
  });

  it("records where a matched student was seen, in every photo where the face passed the threshold", async () => {
    const print = printOf(1, 0);
    const hash = register("S1", print);
    repository.faces = [
      { photoNo: 0, faceNo: 0, print: Array.from(printOf(0, 1)) },
      { photoNo: 0, faceNo: 1, print: Array.from(printOf(1, 0.1)) },
      { photoNo: 1, faceNo: 0, print: Array.from(printOf(0.9, 0.3)) },
      { photoNo: 2, faceNo: 0, print: Array.from(printOf(0.1, 1)) },
    ];
    assert.equal(await service.respond("L1", "S1", print, hash), "present");
    assert.deepEqual(
      repository.sightings.get("S1")?.map((face) => [face.photoNo, face.faceNo]),
      [
        [0, 1],
        [1, 0],
      ],
    );
  });

  it("records no sighting for a student who was not found", async () => {
    const print = printOf(1, 0);
    const hash = register("S1", print);
    repository.faces = [{ photoNo: 0, faceNo: 0, print: Array.from(printOf(0, 1)) }];
    assert.equal(await service.respond("L1", "S1", print, hash), "not_found");
    assert.equal(repository.sightings.has("S1"), false);
  });

  it("TC-022 a second response returns the saved result and compares nothing", async () => {
    repository.results.set("S1", "not_found");
    const print = printOf(1);
    assert.equal(await service.respond("L1", "S1", print, hashOfPrint(print)), "not_found");
    assert.equal(repository.loadFacesCalls, 0);
  });

  it("TC-029 the face-print is all zeros once the response ends", async () => {
    const print = printOf(1, 2, 3);
    const hash = register("S1", print);
    repository.faces = [];
    await service.respond("L1", "S1", print, hash);
    assert.ok(print.every((n) => n === 0));
  });

  it("TC-029 the face-print is also overwritten when the response is refused", async () => {
    repository.round = null;
    const print = printOf(1, 2, 3);
    await assert.rejects(service.respond("L1", "S1", print, "x"), { code: "no_round" });
    assert.ok(print.every((n) => n === 0));
  });

  it("refuses a student of another course", async () => {
    await assert.rejects(service.respond("L1", "S51", printOf(1), "x"), { status: 403, code: "not_in_course" });
  });

  it("TC-100 refuses a response after the hour", async () => {
    repository.round = { lessonId: "L1", expiresAt: new Date(NOW.getTime() - 1) };
    await assert.rejects(service.respond("L1", "S1", printOf(1), "x"), { status: 409, code: "round_closed" });
  });

  it("reads the faces from the database only once", async () => {
    for (const [student, seed] of [["S1", 1], ["S2", 2]] as const) {
      const print = printOf(seed);
      const hash = register(student, print);
      await service.respond("L1", student, print, hash);
    }
    assert.equal(repository.loadFacesCalls, 1);
  });
});

describe("AttendanceService.startRound", () => {
  it("TC-014 saves the round and notifies the course", async () => {
    repository.round = null;
    const round = await service.startRound("L1", "T1", PHOTOS);
    assert.equal(round.expiresAt.getTime() - NOW.getTime(), 3_600_000);
    assert.deepEqual(notified, ["L1"]);
  });

  it("TC-015 refuses another teacher, a time outside the lesson, and a second round", async () => {
    await assert.rejects(service.startRound("L1", "T2", PHOTOS), { status: 403, code: "not_the_teacher" });

    repository.lesson = { ...LESSON, endsAt: new Date(NOW.getTime() - 1) };
    await assert.rejects(service.startRound("L1", "T1", PHOTOS), { status: 403, code: "outside_lesson" });

    repository.lesson = LESSON;
    await assert.rejects(service.startRound("L1", "T1", PHOTOS), { status: 409, code: "round_exists" });
    assert.equal(repository.saveRoundCalls, 0);
  });

  it("refuses no photos or more than three", async () => {
    repository.round = null;
    await assert.rejects(service.startRound("L1", "T1", []), { code: "bad_photos" });
    await assert.rejects(service.startRound("L1", "T1", [...PHOTOS, ...PHOTOS, ...PHOTOS, ...PHOTOS]), { code: "bad_photos" });
  });
});

describe("AttendanceService.sharePhotos", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff]);
  const FILES: SharedPhotoFile[] = [{ photoNo: 0, jpeg: JPEG }];
  const NUMBERS: PhotoNumber[] = [
    { number: 1, photoNo: 0, faceNo: 2, box: [10, 10, 40, 40] },
    { number: 2, photoNo: 0, faceNo: 5, box: [90, 10, 40, 40] },
  ];

  beforeEach(() => {
    repository.round = { lessonId: "L1", expiresAt: new Date(NOW.getTime() - 1) };
  });

  it("saves the photos for 24 hours and tells the students who may pick", async () => {
    const { expiresAt } = await service.sharePhotos("L1", "T1", FILES, NUMBERS);
    assert.equal(expiresAt.getTime() - NOW.getTime(), 24 * 3_600_000);
    assert.deepEqual(repository.shared?.numbers, NUMBERS);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(toldToPick, [["S2", "S3"]]);
  });

  it("refuses another teacher, a share during the hour, and a second share", async () => {
    await assert.rejects(service.sharePhotos("L1", "T2", FILES, NUMBERS), { status: 403, code: "not_the_teacher" });

    repository.round = { lessonId: "L1", expiresAt: new Date(NOW.getTime() + 1) };
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 409, code: "round_open" });

    repository.round = null;
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 404, code: "no_round" });

    repository.round = { lessonId: "L1", expiresAt: new Date(NOW.getTime() - 1) };
    await service.sharePhotos("L1", "T1", FILES, NUMBERS);
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 409, code: "already_shared" });
  });

  it("refuses a number on the face of a present student", async () => {
    repository.identified = [{ photoNo: 0, faceNo: 5 }];
    await assert.rejects(service.sharePhotos("L1", "T1", FILES, NUMBERS), { status: 400, code: "identified_face" });
    assert.equal(repository.shared, null);
  });

  it("refuses photos and numbers that do not fit each other", async () => {
    const refused: [SharedPhotoFile[], PhotoNumber[], string][] = [
      [[], NUMBERS, "bad_photos"],
      [[...FILES, ...FILES], NUMBERS, "bad_photos"],
      [[{ photoNo: 3, jpeg: JPEG }], NUMBERS, "bad_photos"],
      [FILES, [], "bad_numbers"],
      [FILES, [NUMBERS[0]!, { ...NUMBERS[1]!, number: 1 }], "bad_numbers"],
      [FILES, [NUMBERS[0]!, { ...NUMBERS[1]!, faceNo: 2 }], "bad_numbers"],
      [FILES, [{ ...NUMBERS[0]!, photoNo: 1 }], "bad_numbers"],
      [FILES, [{ ...NUMBERS[0]!, number: 0 }], "bad_numbers"],
      [FILES, [{ ...NUMBERS[0]!, box: [1, 2, 3] }], "bad_numbers"],
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

describe("AttendanceService.registerFace", () => {
  it("saves a first hash", async () => {
    assert.equal(await service.registerFace("S1", "a".repeat(64), false), "registered");
    assert.equal(repository.registrations.get("S1")?.hash, "a".repeat(64));
  });

  it("TC-013 sends a new hash for approval, and keeps the old one", async () => {
    repository.registrations.set("S1", { hash: "a".repeat(64), optedOut: false });
    assert.equal(await service.registerFace("S1", "b".repeat(64), false), "waiting_for_teacher");
    assert.equal(repository.registrations.get("S1")?.hash, "a".repeat(64));
    assert.deepEqual(repository.replacements, ["b".repeat(64)]);
  });

  it("TC-012 records an opt-out with no hash", async () => {
    assert.equal(await service.registerFace("S1", null, true), "opted_out");
    assert.deepEqual(repository.registrations.get("S1"), { hash: null, optedOut: true });
  });
});
