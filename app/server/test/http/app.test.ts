import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import express from "express";
import { createApp } from "../../src/http/app.ts";
import { requireUser, signedInUser, type SignedInUser, type UserVerifier } from "../../src/http/auth.ts";

const STUDENT: SignedInUser = { userId: "u1", idNumber: "300000001", role: "student" };
const verifier: UserVerifier = {
  verify: async (token) => (token === "good-token" ? STUDENT : null),
};

function listen(app: express.Express): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    });
  });
}

describe("createApp", () => {
  let server: Server;
  let base: string;

  before(async () => {
    ({ server, base } = await listen(createApp({ webOrigins: ["https://site.example"], verifier })));
  });
  after(() => server.close());

  it("answers GET /health with no sign-in", async () => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("allows only the address of the web client to call from a browser", async () => {
    const allowed = await fetch(`${base}/health`, { headers: { origin: "https://site.example" } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://site.example");

    const other = await fetch(`${base}/health`, { headers: { origin: "https://other.example" } });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });

  it("answers an unknown address with the error format of the API", async () => {
    const response = await fetch(`${base}/nothing-here`);
    assert.equal(response.status, 404);
    assert.equal(((await response.json()) as { error: string }).error, "not_found");
  });
});

describe("requireUser", () => {
  let server: Server;
  let base: string;

  before(async () => {
    const app = express();
    app.get("/private", requireUser(verifier), (_req, res) => {
      res.json(signedInUser(res));
    });
    ({ server, base } = await listen(app));
  });
  after(() => server.close());

  it("refuses a request with no token", async () => {
    const response = await fetch(`${base}/private`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "not_signed_in", message: "Sign in first." });
  });

  it("refuses a token that is not valid", async () => {
    const response = await fetch(`${base}/private`, { headers: { authorization: "Bearer bad-token" } });
    assert.equal(response.status, 401);
  });

  it("passes the signed-in user on to the route", async () => {
    const response = await fetch(`${base}/private`, { headers: { authorization: "Bearer good-token" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), STUDENT);
  });
});
