/**
 * Why a sign-in was refused:
 * - invalid-token:      forged, expired, or issued to a different app
 * - email-not-verified: the account's email address is not verified by Google
 * - wrong-domain:       the account is not from the domain we allow (when one is set)
 */
export type AuthErrorKind = "invalid-token" | "email-not-verified" | "wrong-domain";

/** Thrown by an `IdentityVerifier`. The login route answers 401 for every kind. */
export class AuthError extends Error {
  readonly kind: AuthErrorKind;

  constructor(kind: AuthErrorKind, message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "AuthError";
    this.kind = kind;
  }
}
