import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requireUser, signedInUser, type UserVerifier } from "../http/auth.ts";
import { HttpError } from "../http/errors.ts";
import type { NotificationService } from "../notifications/NotificationService.ts";
import type { AttendanceService } from "./AttendanceService.ts";
import { JPEG, MAX_PHOTO_BYTES, MAX_PHOTOS, PRINT_LENGTH, type PhotoFaces, type PhotoNumber, type SharedPhotoFile } from "./types.ts";

/** The shared photos stay in memory until they are saved in the file storage. */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS } });

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const STATUS_OF_REGISTRATION = { registered: 201, opted_out: 201, waiting_for_teacher: 202 } as const;

function isPrint(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === PRINT_LENGTH && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function requireRole(res: Response, role: "teacher" | "student"): void {
  if (signedInUser(res).role !== role) throw new HttpError(403, role === "teacher" ? "not_the_teacher" : "not_in_course", "You may not do this.");
}

function lessonIdOf(body: { lessonId?: unknown }): string {
  if (typeof body.lessonId !== "string" || !body.lessonId) throw new HttpError(400, "bad_request", "lessonId is missing.");
  return body.lessonId;
}

function photosOf(value: unknown): PhotoFaces[] {
  const valid =
    Array.isArray(value) &&
    value.every(
      (photo) =>
        Array.isArray(photo?.faces) &&
        photo.faces.every((face: { box?: unknown; print?: unknown }) => {
          const box = face?.box;
          return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && isPrint(face.print);
        }),
    );
  if (!valid) throw new HttpError(400, "bad_print", "Each face needs a box and a face-print of 128 numbers.");
  return value as PhotoFaces[];
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
    throw new HttpError(400, "bad_photos", "Each photo must be a JPEG file with its photo number.");
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
    router.post("/faces/register", signedIn, this.registerFace);
    router.post("/attendance/class", signedIn, this.startRound);
    router.post("/attendance/response", signedIn, this.respond);
    router.post("/attendance/photos", signedIn, receivePhotos, this.sharePhotos);
    router.post("/notifications/subscribe", signedIn, this.subscribe);
    return router;
  }

  registerFace = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "student");
    const { hash, optOut } = req.body ?? {};
    if (optOut !== true && !(typeof hash === "string" && HASH_PATTERN.test(hash))) {
      throw new HttpError(400, "bad_print", "A hash of 64 hexadecimal characters is needed.");
    }
    const status = await this.#service.registerFace(signedInUser(res).idNumber, optOut === true ? null : hash, optOut === true);
    res.status(STATUS_OF_REGISTRATION[status]).json({ status });
  };

  startRound = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "teacher");
    const body = req.body ?? {};
    const round = await this.#service.startRound(lessonIdOf(body), signedInUser(res).idNumber, photosOf(body.photos));
    res.status(201).json({ expiresAt: round.expiresAt.toISOString() });
  };

  respond = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "student");
    const body = req.body ?? {};
    if (!isPrint(body.print) || typeof body.hash !== "string") throw new HttpError(400, "bad_print", "A face-print of 128 numbers and its hash are needed.");

    const print = Float32Array.from(body.print as number[]);
    (body.print as number[]).fill(0);
    const result = await this.#service.respond(lessonIdOf(body), signedInUser(res).idNumber, print, body.hash);
    res.json({ result });
  };

  sharePhotos = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "teacher");
    const body = req.body ?? {};
    const files = sharedFilesOf((req.files as Express.Multer.File[] | undefined) ?? [], jsonField(body.photoNos, "photoNos"));
    const numbers = numbersOf(jsonField(body.numbers, "numbers"));
    const { expiresAt } = await this.#service.sharePhotos(lessonIdOf(body), signedInUser(res).idNumber, files, numbers);
    res.status(201).json({ expiresAt: expiresAt.toISOString() });
  };

  subscribe = async (req: Request, res: Response): Promise<void> => {
    requireRole(res, "student");
    const { endpoint, keys } = req.body ?? {};
    if (typeof endpoint !== "string" || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      throw new HttpError(400, "bad_request", "A browser subscription is needed.");
    }
    await this.#notifications.subscribe(signedInUser(res).idNumber, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
    res.status(204).end();
  };
}

function receivePhotos(req: Request, res: Response, next: NextFunction): void {
  upload.array("photos", MAX_PHOTOS)(req, res, (error: unknown) => {
    const code = (error as { code?: string })?.code;
    if (code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "file_too_large", "A photo is larger than 10 MB."));
      return;
    }
    if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") {
      next(new HttpError(400, "bad_photos", `Send 1 to ${MAX_PHOTOS} photos.`));
      return;
    }
    next(error);
  });
}
