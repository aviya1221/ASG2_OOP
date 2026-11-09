import { Router, type Request, type Response } from "express";
import { requireUser, signedInUser, type UserVerifier } from "../http/auth.ts";
import { HttpError } from "../http/errors.ts";
import type { NotificationService } from "../notifications/NotificationService.ts";
import type { AttendanceService } from "./AttendanceService.ts";
import { PRINT_LENGTH, type PhotoFaces } from "./types.ts";

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
