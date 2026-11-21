import { error as logError } from "firebase-functions/logger";

export async function sendAppCheckToken(request, response, { extensionOrigin, verify, mint }) {
  response.set("Cache-Control", "no-store");
  response.set("Vary", "Origin");

  const origin = request.get("Origin");
  if (!origin || origin !== extensionOrigin) {
    return response.status(403).json({ error: "origin_denied" });
  }

  // The origin limits browser access. The signed Firebase ID token identifies the caller.
  response.set("Access-Control-Allow-Origin", origin);
  if (request.method === "OPTIONS") {
    response.set("Access-Control-Allow-Methods", "POST");
    response.set("Access-Control-Allow-Headers", "Authorization");
    return response.status(204).end();
  }
  if (request.method !== "POST") {
    response.set("Allow", "POST, OPTIONS");
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const bearer = /^Bearer (\S+)$/i.exec(request.get("Authorization") ?? "");
  if (!bearer) {
    return response.status(401).json({ error: "sign_in_required" });
  }

  let user;
  try {
    user = await verify(bearer[1]);
  } catch {
    return response.status(401).json({ error: "invalid_id_token" });
  }

  if (user.firebase?.sign_in_provider !== "google.com" || user.email_verified !== true) {
    return response.status(403).json({ error: "verified_google_account_required" });
  }

  const startedAt = Date.now();
  try {
    const { token, ttlMillis } = await mint();
    return response.json({ token, expireTimeMillis: startedAt + ttlMillis });
  } catch (err) {
    logError("Could not mint App Check token", { code: err?.code });
    return response.status(503).json({ error: "token_unavailable" });
  }
}
