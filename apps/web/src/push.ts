import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { pushConfigured, vapidKey } from "./firebase-config";
import { removeInstallation, saveInstallation } from "./push-profile";

interface Enrollment {
  uid: string;
  fid: string;
}

function storageKey(db: Firestore) {
  return "bifocal-push:" + db.app.options.appId;
}

function readEnrollment(db: Firestore): Enrollment | null {
  try {
    const saved = localStorage.getItem(storageKey(db));
    return saved ? JSON.parse(saved) as Enrollment : null;
  } catch {
    return null;
  }
}

export function pushIsEnabled(db: Firestore, uid: string) {
  return pushConfigured && readEnrollment(db)?.uid === uid && globalThis.Notification?.permission === "granted";
}

export async function pushIsSupported() {
  return pushConfigured && (await import("firebase/messaging")).isSupported();
}

export async function enablePush(db: Firestore, user: User) {
  // Request permission directly from the user's click, before loading FCM.
  if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") {
    return false;
  }

  const { getMessaging, onRegistered, register, unregister } = await import("firebase/messaging");
  const messaging = getMessaging(db.app);
  const previous = readEnrollment(db);
  if (previous && previous.uid !== user.uid) {
    await unregister(messaging);
    const { deleteInstallations, getInstallations } = await import("firebase/installations");
    await deleteInstallations(getInstallations(db.app));
    localStorage.removeItem(storageKey(db));
  }

  let fid: string | undefined;
  const unsubscribe = onRegistered(messaging, (id) => { fid = id; });
  try {
    await register(messaging, { vapidKey });
    if (!fid) throw new Error("FCM did not return an installation ID.");
    await saveInstallation(db, user, fid);
    localStorage.setItem(storageKey(db), JSON.stringify({ uid: user.uid, fid }));
    return true;
  } finally {
    unsubscribe();
  }
}

export async function disablePush(db: Firestore, uid: string) {
  if (!pushConfigured) return;
  const enrollment = readEnrollment(db);
  if (enrollment?.uid !== uid) return;

  await removeInstallation(db, uid, enrollment.fid);
  localStorage.removeItem(storageKey(db));
}
