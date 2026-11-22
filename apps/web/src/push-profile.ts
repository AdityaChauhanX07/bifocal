import type { User } from "firebase/auth";
import { deleteField, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export function saveInstallation(db: Firestore, user: Pick<User, "uid" | "displayName">, fid: string) {
  const ref = doc(db, "users", user.uid);
  return runTransaction(db, async (transaction) => {
    const profile = await transaction.get(ref);
    if (profile.get("fcmInstallationId") === fid) return;

    if (profile.exists()) {
      transaction.update(ref, { fcmInstallationId: fid });
    } else {
      transaction.set(ref, {
        displayName: user.displayName?.trim().slice(0, 100) || "Trusted contact",
        role: "contact",
        createdAt: serverTimestamp(),
        fcmInstallationId: fid,
      });
    }
  });
}

export function removeInstallation(db: Firestore, uid: string, fid: string) {
  const ref = doc(db, "users", uid);
  return runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).get("fcmInstallationId") === fid) {
      transaction.update(ref, { fcmInstallationId: deleteField() });
    }
  });
}
