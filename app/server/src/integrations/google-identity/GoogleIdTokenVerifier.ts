import { OAuth2Client } from "google-auth-library";
import { AuthError, type IdentityVerifier, type VerifiedIdentity } from "../../auth/index.ts";
import type { GoogleSignInConfig } from "./GoogleSignInConfig.ts";

/** The part of google-auth-library's `OAuth2Client` we use; tests pass a fake. */
export type GoogleTokenClient = Pick<OAuth2Client, "verifyIdToken">;

/**
 * Checks the ID token that the "Sign in with Google" button gives the
 * browser, following Google's guide "Verify the Google ID token on your
 * server side" (https://developers.google.com/identity/gsi/web/guides/verify-google-id-token):
 *
 * 1. `verifyIdToken` checks Google's signature, that the token was issued to
 *    OUR client ID (`aud`), that Google issued it (`iss`) and that it has not
 *    expired (`exp`).
 * 2. We check the rest ourselves: a verified email, the allowed Workspace
 *    domain (`hd`) when one is set, and whether Google is the authority for
 *    the address.
 *
 * One instance is shared by the whole server, so Google's public keys are
 * downloaded once and cached, not on every sign-in.
 */
export class GoogleIdTokenVerifier implements IdentityVerifier {
  readonly #config: GoogleSignInConfig;
  readonly #client: GoogleTokenClient;

  constructor(config: GoogleSignInConfig, client: GoogleTokenClient = new OAuth2Client()) {
    this.#config = config;
    this.#client = client;
  }

  async verify(credential: string): Promise<VerifiedIdentity> {
    if (!credential) throw new AuthError("invalid-token", "No Google credential was sent");

    let payload;
    try {
      const ticket = await this.#client.verifyIdToken({ idToken: credential, audience: this.#config.clientId });
      payload = ticket.getPayload();
    } catch (cause) {
      throw new AuthError("invalid-token", "The Google credential is not valid for this app", { cause });
    }
    if (!payload?.sub || !payload.email) {
      throw new AuthError("invalid-token", "The Google credential has no account id or email");
    }

    if (payload.email_verified !== true) {
      throw new AuthError("email-not-verified", "The Google account's email address is not verified");
    }
    const { allowedDomain } = this.#config;
    if (allowedDomain && payload.hd?.toLowerCase() !== allowedDomain.toLowerCase()) {
      throw new AuthError("wrong-domain", `Only accounts of ${allowedDomain} can sign in`);
    }

    return {
      provider: "google",
      subject: payload.sub,
      email: payload.email,
      // Google's rule: authoritative for @gmail.com, or for a verified Workspace (hd) address.
      emailAuthoritative: payload.email.toLowerCase().endsWith("@gmail.com") || payload.hd !== undefined,
      name: payload.name,
      pictureUrl: payload.picture,
      hostedDomain: payload.hd,
    };
  }
}
