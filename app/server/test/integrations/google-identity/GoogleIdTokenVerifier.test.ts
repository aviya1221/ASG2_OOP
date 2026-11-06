import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthError } from "../../../src/auth/index.ts";
import { GoogleIdTokenVerifier, type GoogleTokenClient } from "../../../src/integrations/google-identity/index.ts";

const CLIENT_ID = "1234-test.apps.googleusercontent.com";

/** The fields of a Google ID token payload that the verifier reads. */
const STUDENT = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: 2_000_000_000,
  sub: "110169484474386276334",
  email: "dana.levi@gmail.com",
  email_verified: true,
  name: "Dana Levi",
  picture: "https://lh3.googleusercontent.com/a/photo",
};

/** Stand-in for google-auth-library: returns the given payload, or throws like a bad token. */
function fakeClient(payload: object | Error) {
  const calls: unknown[] = [];
  const client = {
    verifyIdToken: async (options: unknown) => {
      calls.push(options);
      if (payload instanceof Error) throw payload;
      return { getPayload: () => payload };
    },
  };
  return { client: client as unknown as GoogleTokenClient, calls };
}

describe("GoogleIdTokenVerifier", () => {
  it("checks the token against our client ID and returns who signed in", async () => {
    const { client, calls } = fakeClient(STUDENT);
    const identity = await new GoogleIdTokenVerifier({ clientId: CLIENT_ID }, client).verify("header.payload.sig");

    assert.deepEqual(calls, [{ idToken: "header.payload.sig", audience: CLIENT_ID }]);
    assert.deepEqual(identity, {
      provider: "google",
      subject: "110169484474386276334",
      email: "dana.levi@gmail.com",
      emailAuthoritative: true,
      name: "Dana Levi",
      pictureUrl: "https://lh3.googleusercontent.com/a/photo",
      hostedDomain: undefined,
    });
  });

  it("refuses a token the library rejects (forged, expired, other app)", async () => {
    const { client } = fakeClient(new Error("Wrong recipient, payload audience != requiredAudience"));
    await assert.rejects(new GoogleIdTokenVerifier({ clientId: CLIENT_ID }, client).verify("x.y.z"), {
      name: "AuthError",
      kind: "invalid-token",
    });
  });

  it("refuses an empty credential without calling Google", async () => {
    const { client, calls } = fakeClient(STUDENT);
    await assert.rejects(new GoogleIdTokenVerifier({ clientId: CLIENT_ID }, client).verify(""), { kind: "invalid-token" });
    assert.equal(calls.length, 0);
  });

  it("refuses an account whose email is not verified", async () => {
    const { client } = fakeClient({ ...STUDENT, email: "dana@example.com", email_verified: false });
    await assert.rejects(new GoogleIdTokenVerifier({ clientId: CLIENT_ID }, client).verify("x.y.z"), {
      kind: "email-not-verified",
    });
  });

  it("accepts only the allowed Workspace domain when one is set", async () => {
    const config = { clientId: CLIENT_ID, allowedDomain: "students.example.ac.il" };

    const outsider = fakeClient(STUDENT);
    await assert.rejects(new GoogleIdTokenVerifier(config, outsider.client).verify("x.y.z"), (error: unknown) => {
      assert.ok(error instanceof AuthError);
      assert.equal(error.kind, "wrong-domain");
      return true;
    });

    const member = fakeClient({ ...STUDENT, email: "dana@students.example.ac.il", hd: "students.example.ac.il" });
    const identity = await new GoogleIdTokenVerifier(config, member.client).verify("x.y.z");
    assert.equal(identity.hostedDomain, "students.example.ac.il");
    assert.equal(identity.emailAuthoritative, true);
  });

  it("marks a verified non-Gmail address outside Workspace as not authoritative", async () => {
    const { client } = fakeClient({ ...STUDENT, email: "dana@yahoo.com" });
    const identity = await new GoogleIdTokenVerifier({ clientId: CLIENT_ID }, client).verify("x.y.z");
    assert.equal(identity.emailAuthoritative, false);
  });
});
