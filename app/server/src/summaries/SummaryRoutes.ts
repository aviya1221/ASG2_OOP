import { tmpdir } from "node:os";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requireUser, signedInUser, type UserVerifier } from "../http/auth.ts";
import { HttpError } from "../http/errors.ts";
import type { SummaryService } from "./SummaryService.ts";
import { MAX_RECORDING_BYTES } from "./types.ts";

const upload = multer({ dest: tmpdir(), limits: { fileSize: MAX_RECORDING_BYTES, files: 1 } });

/** POST /summaries (docs/07-EDD/README.md, API docs). */
export class SummaryRoutes {
  readonly #service: SummaryService;
  readonly #verifier: UserVerifier;

  constructor(service: SummaryService, verifier: UserVerifier) {
    this.#service = service;
    this.#verifier = verifier;
  }

  router(): Router {
    const router = Router();
    router.post("/summaries", requireUser(this.#verifier), this.#receive, this.create);
    return router;
  }

  #receive = (req: Request, res: Response, next: NextFunction): void => {
    upload.single("recording")(req, res, (error: unknown) => {
      if ((error as { code?: string })?.code === "LIMIT_FILE_SIZE") {
        next(new HttpError(413, "file_too_large", "The recording is larger than 200 MB."));
        return;
      }
      next(error);
    });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const user = signedInUser(res);
    const file = req.file;
    if (!file) throw new HttpError(400, "bad_request", "A recording is needed.");
    if (user.role !== "teacher") throw new HttpError(403, "not_the_teacher", "Only the teacher of the lesson can do this.");
    const lessonId = typeof req.body?.lessonId === "string" ? req.body.lessonId : "";
    if (!/^(video|audio)\//.test(file.mimetype)) throw new HttpError(400, "bad_request", "The recording must be a video or a sound file.");

    await this.#service.start(lessonId, user.idNumber, { path: file.path, mimeType: file.mimetype });
    res.status(202).json({ status: "in_progress" });
  };
}
