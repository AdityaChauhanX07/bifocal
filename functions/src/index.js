import { getAppCheck } from "firebase-admin/app-check";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { sendAppCheckToken } from "./app-check.js";

initializeApp();

const extensionOrigin = defineString("BIFOCAL_EXTENSION_ORIGIN", {
  description: "Chrome extension origin, without a trailing slash.",
});
const extensionAppId = defineString("BIFOCAL_EXTENSION_APP_ID", {
  description: "Firebase Web app ID registered for the Bifocal extension.",
});
const tokenTtl = 30 * 60 * 1000;

export const mintAppCheckToken = onRequest(
  { cors: false, region: "us-central1", maxInstances: 2 },
  (request, response) =>
    sendAppCheckToken(request, response, {
      extensionOrigin: extensionOrigin.value(),
      verify: (idToken) => getAuth().verifyIdToken(idToken, true),
      mint: () => getAppCheck().createToken(extensionAppId.value(), { ttlMillis: tokenTtl }),
    }),
);
