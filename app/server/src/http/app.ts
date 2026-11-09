import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response, type Router } from "express";
import type { UserVerifier } from "./auth.ts";
import { HttpError, sendError } from "./errors.ts";

export interface AppOptions {
  /** The addresses of the web client that may call this server from a browser. */
  webOrigins: string[];
  verifier: UserVerifier;
  /** The routes of the features. */
  routers?: Router[];
}

const MAX_JSON_BODY = "1mb";

/** The whole server as one object, so tests can start it on a free port. */
export function createApp({ webOrigins, routers = [] }: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: webOrigins }));
  app.use(express.json({ limit: MAX_JSON_BODY }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  for (const router of routers) app.use(router);

  app.use((_req, res) => {
    sendError(res, 404, "not_found", "There is no such address.");
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    if (isBadBody(error)) {
      sendError(res, 400, "bad_request", "The request is not valid.");
      return;
    }
    console.error(error instanceof Error ? error.message : "Unknown error");
    sendError(res, 500, "server_error", "Something went wrong on the server.");
  });

  return app;
}

function isBadBody(error: unknown): boolean {
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}
