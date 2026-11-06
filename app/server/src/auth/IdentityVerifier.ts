/**
 * Who the person signing in is, as proven by an identity provider (Google).
 *
 * This is identity only. Whether the person is an admin, a teacher or a
 * student, and which lessons they see, comes from our own data (the
 * timetable the admin builds), never from Google.
 */
export interface VerifiedIdentity {
  provider: "google";
  /**
   * The provider's permanent id for this account. Store this and look users
   * up by it: Google never reuses it, while an email address can change.
   */
  subject: string;
  email: string;
  /**
   * True when Google is the authority for this address (a Gmail address, or a
   * verified address of a Google Workspace domain). Only then is it safe to
   * match a first sign-in to a person the admin added by email.
   */
  emailAuthoritative: boolean;
  name?: string;
  pictureUrl?: string;
  /** The Google Workspace domain of the account, if it has one (e.g. a university domain). */
  hostedDomain?: string;
}

/** Checks a sign-in credential sent by the browser and says who it belongs to. */
export interface IdentityVerifier {
  /** Throws `AuthError` when the credential is not valid for our app. */
  verify(credential: string): Promise<VerifiedIdentity>;
}
