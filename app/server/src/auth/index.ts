/**
 * Public entry of the sign-in layer. Login routes import from here only:
 *   import { type IdentityVerifier, AuthError } from "../auth/index.ts";
 */
export type { IdentityVerifier, VerifiedIdentity } from "./IdentityVerifier.ts";
export { AuthError, type AuthErrorKind } from "./AuthError.ts";
