import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

export async function notifyTrustedContact(ref, { send, dashboardUrl }) {
  const request = await ref.get();
  if (request.get("status") !== "pending") return;

  const circle = await ref.parent.parent.get();
  const contactUid = circle.get("contactUid");
  if (typeof contactUid !== "string" || !contactUid) return;

  const db = ref.firestore;
  const profile = db.collection("users").doc(contactUid);
  const fid = (await profile.get()).get("fcmInstallationId");
  if (typeof fid !== "string" || !/^[c-f][A-Za-z0-9_-]{21}$/.test(fid)) return;

  const tag = createHash("sha256").update(ref.path).digest("base64url").slice(0, 32);
  try {
    await send({
      fid,
      webpush: {
        headers: { TTL: "300", Topic: tag },
        notification: {
          title: "Bifocal",
          body: "You have a new help request.",
          tag,
          renotify: false,
        },
        fcmOptions: { link: dashboardUrl },
      },
    });
  } catch (error) {
    if (error?.code !== "messaging/installation-id-not-registered") throw error;

    await db.runTransaction(async (transaction) => {
      if ((await transaction.get(profile)).get("fcmInstallationId") === fid) {
        transaction.update(profile, { fcmInstallationId: FieldValue.delete() });
      }
    });
  }
}
