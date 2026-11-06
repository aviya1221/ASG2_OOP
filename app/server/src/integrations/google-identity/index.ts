/**
 * "Sign in with Google": implements the sign-in layer's `IdentityVerifier`
 * with Google's official library. Nothing outside this folder imports
 * google-auth-library.
 */
export { GoogleIdTokenVerifier, type GoogleTokenClient } from "./GoogleIdTokenVerifier.ts";
export type { GoogleSignInConfig } from "./GoogleSignInConfig.ts";
