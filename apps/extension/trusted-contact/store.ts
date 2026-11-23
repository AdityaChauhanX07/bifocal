import type { ContactReply, ContactRequest } from "@bifocal/core";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import type { DocumentReference, Firestore, Unsubscribe } from "firebase/firestore";

export interface Circle {
  contactEmail: string;
  contactUid: string | null;
  contactName?: string;
}

export function watchCircle(
  db: Firestore,
  uid: string,
  onCircle: (circle: Circle | null) => void,
  onError: () => void,
): Unsubscribe {
  return onSnapshot(doc(db, "circles", uid), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    onCircle((snapshot.data() as Circle | undefined) ?? null);
  }, onError);
}

export async function saveInvitation(db: Firestore, uid: string, email: string) {
  const contactEmail = email.trim().toLowerCase();
  const ref = doc(db, "circles", uid);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      if (existing.data().contactUid) throw new Error("This invitation has already been accepted.");
      transaction.update(ref, { contactEmail });
      return;
    }

    transaction.set(ref, {
      protectedUid: uid,
      contactEmail,
      contactUid: null,
      createdAt: serverTimestamp(),
    });
  });
}

export function requestRef(db: Firestore, uid: string, id?: string): DocumentReference {
  const requests = collection(db, "circles", uid, "requests");
  return id ? doc(requests, id) : doc(requests);
}

export async function sendRequest(ref: DocumentReference, draft: ContactRequest) {
  // The transaction requires a connection. Reusing the reference makes a retry safe.
  await runTransaction(ref.firestore, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) return;

    transaction.set(ref, {
      tier: draft.tier,
      tactics: draft.tactics,
      summary: draft.summary,
      channel: draft.channel,
      createdAt: serverTimestamp(),
      status: "pending",
    });
  });
}

export function watchReply(
  ref: DocumentReference,
  onReply: (reply: ContactReply | null) => void,
  onError: () => void,
): Unsubscribe {
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    const request = snapshot.data();
    onReply(request?.status === "replied"
      ? { replyPreset: request.replyPreset, replyNote: request.replyNote }
      : null);
  }, onError);
}
