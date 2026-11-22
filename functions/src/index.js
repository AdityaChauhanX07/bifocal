import { getAppCheck } from "firebase-admin/app-check";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { notifyTrustedContact } from "./request-push.js";
import { sendAppCheckToken } from "./app-check.js";

initializeApp();

const extensionOrigin = defineString("BIFOCAL_EXTENSION_ORIGIN", {
  description: "Chrome extension origin, without a trailing slash.",
});
const extensionAppId = defineString("BIFOCAL_EXTENSION_APP_ID", {
  description: "Firebase Web app ID registered for the Bifocal extension.",
});
const tokenTtl = 30 * 60 * 1000;
const dashboardUrl = defineString("BIFOCAL_DASHBOARD_URL", {
  description: "HTTPS URL of the trusted-contact dashboard.",
});

export const mintAppCheckToken = onRequest(
  { cors: false, region: "us-central1", maxInstances: 2 },
  (request, response) =>
    sendAppCheckToken(request, response, {
      extensionOrigin: extensionOrigin.value(),
      verify: (idToken) => getAuth().verifyIdToken(idToken, true),
      mint: () => getAppCheck().createToken(extensionAppId.value(), { ttlMillis: tokenTtl }),
    }),
);

export const notifyOnRequest = onDocumentCreated(
  {
    document: "circles/{circleId}/requests/{requestId}",
    region: "us-central1",
    maxInstances: 2,
  },
  async (event) => {
    if (!event.data || process.env.FUNCTIONS_EMULATOR === "true") return;
    await notifyTrustedContact(event.data.ref, {
      send: (message) => getMessaging().send(message),
      dashboardUrl: dashboardUrl.value(),
    });
  },
);
