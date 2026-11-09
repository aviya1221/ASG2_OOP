import type { NextFunction, Request, Response } from "express";
import { sendError } from "./errors.ts";

export type Role = "admin" | "teacher" | "student";

export interface SignedInUser {
  userId: string;
  idNumber: string;
  role: Role;
}

/** Turns a sign-in token into the person who holds it, or null for a token that is not valid. */
export interface UserVerifier {
  verify(token: string): Promise<SignedInUser | null>;
}

/** The signed-in user of a request, as set by `requireUser`. */
export function signedInUser(res: Response): SignedInUser {
  return res.locals.user as SignedInUser;
}

/** Lets a request through only with a valid sign-in token (docs/07-EDD/README.md, API docs). */
export function requireUser(verifier: UserVerifier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const user = token ? await verifier.verify(token) : null;
    if (!user) {
      sendError(res, 401, "not_signed_in", "Sign in first.");
      return;
    }
    res.locals.user = user;
    next();
  };
}
