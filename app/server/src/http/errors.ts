import type { Response } from "express";

/** Every error of the server has this form (docs/07-EDD/README.md, API docs). */
export interface ErrorBody {
  error: string;
  message: string;
}

export function sendError(res: Response, status: number, error: string, message: string): void {
  const body: ErrorBody = { error, message };
  res.status(status).json(body);
}
