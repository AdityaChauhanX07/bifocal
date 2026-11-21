import assert from "node:assert/strict";
import { test } from "node:test";
import { sendAppCheckToken } from "../src/app-check.js";

const extensionOrigin = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const googleUser = { firebase: { sign_in_provider: "google.com" }, email_verified: true };
const appCheckToken = { token: "app-check-token", ttlMillis: 1_800_000 };

async function callEndpoint({
  origin = extensionOrigin,
  method = "POST",
  authorization = "Bearer firebase-id-token",
  verify = async () => googleUser,
  mint = async () => appCheckToken,
} = {}) {
  const headers = { Origin: origin, Authorization: authorization };
  const request = { method, get: (name) => headers[name] };
  const response = {
    headers: {},
    statusCode: 200,
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };

  await sendAppCheckToken(request, response, { extensionOrigin, verify, mint });
  return response;
}

test("allows the extension preflight without checking credentials", async () => {
  const verify = () => assert.fail("preflight must not look up the user");
  const response = await callEndpoint({ method: "OPTIONS", authorization: "", verify });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["Access-Control-Allow-Origin"], extensionOrigin);
  assert.equal(response.headers["Access-Control-Allow-Headers"], "Authorization");
});

test("rejects requests from a different origin", async () => {
  const verify = () => assert.fail("requests from other origins must not reach Auth");
  const response = await callEndpoint({ origin: "https://other.example", verify });
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
});

test("requires a POST with a Firebase ID token", async () => {
  const wrongMethod = await callEndpoint({ method: "GET" });
  assert.equal(wrongMethod.statusCode, 405);

  const missingToken = await callEndpoint({ authorization: "" });
  assert.equal(missingToken.statusCode, 401);
});

test("does not mint a token when Auth rejects the ID token", async () => {
  const verify = async () => {
    throw new Error("invalid ID token");
  };
  const mint = () => assert.fail("invalid IDs must not get an App Check token");
  const response = await callEndpoint({ verify, mint });
  assert.equal(response.statusCode, 401);
});

test("requires a verified Google sign-in", async () => {
  const mint = () => assert.fail("unverified users must not get an App Check token");
  for (const user of [
    { ...googleUser, email_verified: false },
    { ...googleUser, firebase: { sign_in_provider: "password" } },
  ]) {
    const response = await callEndpoint({ verify: async () => user, mint });
    assert.equal(response.statusCode, 403);
  }
});

test("returns the SDK token shape with a millisecond expiration and no caching", async () => {
  const before = Date.now();
  const response = await callEndpoint({
    verify: async (token) => {
      assert.equal(token, "firebase-id-token");
      return googleUser;
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.body.token, appCheckToken.token);
  assert.ok(response.body.expireTimeMillis >= before + appCheckToken.ttlMillis);
  assert.ok(response.body.expireTimeMillis <= Date.now() + appCheckToken.ttlMillis);
});
