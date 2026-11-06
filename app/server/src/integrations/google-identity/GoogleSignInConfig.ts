/**
 * Settings for "Sign in with Google". Read from environment variables by
 * src/config/env.ts. The setup steps in Google Cloud are in app/README.md.
 */
export interface GoogleSignInConfig {
  /**
   * OAuth client ID of type "Web application", e.g.
   * 1234-abc.apps.googleusercontent.com. Not a secret: the browser needs it too.
   */
  clientId: string;
  /**
   * Optional. Only accept accounts of this Google Workspace domain
   * (e.g. the university's student domain). Unset = any Google account.
   */
  allowedDomain?: string;
}
