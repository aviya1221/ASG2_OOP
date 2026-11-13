import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requireUser, signedInUser, type UserVerifier } from "../http/auth.ts";
import { HttpError } from "../http/errors.ts";
import type { NotificationService } from "../notifications/NotificationService.ts";
import type { AttendanceService } from "./AttendanceService.ts";
import { JPEG, MAX_PHOTO_BYTES, MAX_PHOTOS, type PhotoNumber, type SharedPhotoFile } from "./types.ts";

/** The shared photo stays in memory until it is saved in the file storage. */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS } });

function requireRole(res: Response, role: "teacher" | "student"): void {
  if (signedInUser(res).role !== role) throw new HttpError(403, role === "teacher" ? "not_the_teacher" : "not_in_course", "You may not do this.");
}

function lessonIdOf(body: { lessonId?: unknown }): string {
  if (typeof body.lessonId !== "string" || !body.lessonId) throw new HttpError(400, "bad_request", "lessonId is missing.");
  return body.lessonId;
}

function faceCountOf(body: { faceCount?: unknown }): number {
  if (typeof body.faceCount !== "number") throw new HttpError(400, "bad_count", "faceCount is missing.");
  return body.faceCount;
}

function jsonField(value: unknown, name: string): unknown {
  if (typeof value !== "string") throw new HttpError(400, "bad_request", `${name} is missing.`);
  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(400, "bad_request", `${name} is not valid JSON.`);
  }
}

/** Each file is a JPEG, and `photoNos` says which photo of the round it is, in the same order. */
function sharedFilesOf(files: Express.Multer.File[], photoNos: unknown): SharedPhotoFile[] {
  const isJpeg = (file: Express.Multer.File) => file.mimetype === JPEG && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  if (!Array.isArray(photoNos) || photoNos.length !== files.length || !files.every(isJpeg)) {
    throw new HttpError(400, "bad_photos", "The photo must be a JPEG file with its photo number.");
  }
  return files.map((file, index) => ({ photoNo: Number(photoNos[index]), jpeg: file.buffer }));
}

function numbersOf(value: unknown): PhotoNumber[] {
  const valid =
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item?.number === "number" &&
        typeof item?.photoNo === "number" &&
        typeof item?.faceNo === "number" &&
        Array.isArray(item?.box) &&
        item.box.every((n: unknown) => typeof n === "number"),
    );
  if (!valid) throw new HttpError(400, "bad_numbers", "Each number needs a photo, a face and a box.");
  return (value as PhotoNumber[]).map(({ number, photoNo, faceNo, box }) => ({ number, photoNo, faceNo, box }));
}

/** The calls of attendance (docs/07-EDD/README.md, API docs). */
export class AttendanceRoutes {
  readonly #service: AttendanceService;
  readonly #notifications: NotificationService;
  readonly #verifier: UserVerifier;

  constructor(service: AttendanceService, notifications: NotificationService, verifier: UserVerifier) {
    this.#service = service;
    this.#notifications = notifications;
    this.#verifier = verifier;
  }

  router(): Router {
    const router = Router();
    const signedIn = requireUser(this.#verifier);
    router.post("/attendance/class", signedIn, this.startRound);
    router.post("/attendance/photos", signedIn, receivePhotos, this.sharePhotos);
    router.post("/notifications/subscribe", signedIn, this.subscribe);
    return router;
  }

  /** Only the number of faces leaves the teacher's phone. */
  startRound = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "teacher");
    const body = req.body ?? {};
    const round = await this.#service.startRound(lessonIdOf(body), signedInUser(res).personId, faceCountOf(body));
    res.status(201).json({ expiresAt: round.expiresAt.toISOString() });
  };

  sharePhotos = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "teacher");
    const body = req.body ?? {};
    const files = sharedFilesOf((req.files as Express.Multer.File[] | undefined) ?? [], jsonField(body.photoNos, "photoNos"));
    const numbers = numbersOf(jsonField(body.numbers, "numbers"));
    const { expiresAt } = await this.#service.sharePhotos(lessonIdOf(body), signedInUser(res).personId, files, numbers);
    res.status(201).json({ expiresAt: expiresAt.toISOString() });
  };

  subscribe = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "student");
    const { endpoint, keys } = req.body ?? {};
    if (typeof endpoint !== "string" || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      throw new HttpError(400, "bad_request", "A browser subscription is needed.");
    }
    await this.#notifications.subscribe(signedInUser(res).personId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
    res.status(204).end();
  };
}

function receivePhotos(req: Request, res: Response, next: NextFunction): void {
  upload.array("photos", MAX_PHOTOS)(req, res, (error: unknown) => {
    const code = (error as { code?: string })?.code;
    if (code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "file_too_large", "The photo is larger than 10 MB."));
      return;
    }
    if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") {
      next(new HttpError(400, "bad_photos", "Send the class photo once."));
      return;
    }
    next(error);
  });
}
