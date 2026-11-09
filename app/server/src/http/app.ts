import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { UserVerifier } from "./auth.ts";
import { sendError } from "./errors.ts";

export interface AppOptions {
  /** The addresses of the web client that may call this server from a browser. */
  webOrigins: string[];
  verifier: UserVerifier;
}

/** The whole server as one object, so tests can start it on a free port. */
export function createApp({ webOrigins }: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: webOrigins }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use((_req, res) => {
    sendError(res, 404, "not_found", "There is no such address.");
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error instanceof Error ? error.message : "Unknown error");
    sendError(res, 500, "server_error", "Something went wrong on the server.");
  });

  return app;
}
