import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requireUser, signedInUser, type UserVerifier } from "../http/auth.ts";
import { HttpError } from "../http/errors.ts";
import type { HomeworkService } from "./HomeworkService.ts";
import { MAX_PDF_BYTES, PDF } from "./types.ts";

/** Files stay in memory and are never written to the server's disk (REQ-59). */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 1 } });

function pdfOf(file: Express.Multer.File | undefined): Uint8Array {
  const isPdf = file && file.mimetype === PDF && file.buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!isPdf) throw new HttpError(400, "not_a_pdf", "A PDF file is needed.");
  return file.buffer;
}

function textOf(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "bad_request", `${name} is missing.`);
  return value.trim();
}

/** POST /homework and POST /homework/{id}/checks (docs/07-EDD/README.md, API docs). */
export class HomeworkRoutes {
  readonly #service: HomeworkService;
  readonly #verifier: UserVerifier;

  constructor(service: HomeworkService, verifier: UserVerifier) {
    this.#service = service;
    this.#verifier = verifier;
  }

  router(): Router {
    const router = Router();
    const signedIn = requireUser(this.#verifier);
    router.post("/homework", signedIn, this.#receive("file"), this.publish);
    router.post("/homework/:id/checks", signedIn, this.#receive("solution"), this.check);
    return router;
  }

  #receive(field: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      upload.single(field)(req, res, (error: unknown) => {
        if ((error as { code?: string })?.code === "LIMIT_FILE_SIZE") {
          next(new HttpError(413, "file_too_large", "The file is larger than 20 MB."));
          return;
        }
        next(error);
      });
    };
  }

  publish = async (req: Request, res: Response): Promise<void> => {
    const user = signedInUser(res);
    if (user.role !== "teacher") throw new HttpError(403, "not_the_teacher", "Only the teacher of the lesson can do this.");
    const pdf = pdfOf(req.file);
    const { homework, questions } = await this.#service.publish(textOf(req.body?.lessonId, "lessonId"), user.idNumber, textOf(req.body?.title, "title"), pdf);
    res.status(201).json({ homeworkId: homework.id, questions });
  };

  check = async (req: Request, res: Response): Promise<void> => {
    const user = signedInUser(res);
    if (user.role !== "student") throw new HttpError(403, "not_in_course", "Only a student of the lesson can do this.");
    const check = await this.#service.check(String(req.params.id), user.idNumber, pdfOf(req.file));
    res.json({ checkNumber: check.checkNumber, overall: check.overall, questionScores: check.questionScores, report: check.report });
  };
}
