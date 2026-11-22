import type { ContactReply, ContactRequest, ReplyPreset } from "@bifocal/core";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  collection, doc, getDocsFromServer, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import type { DocumentReference, Firestore, Timestamp, Unsubscribe } from "firebase/firestore";

export type Reply = { replyPreset: ReplyPreset } | { replyNote: string };

interface RequestFields extends ContactRequest, ContactReply {
  createdAt: Timestamp;
  status: "pending" | "replied";
  repliedAt?: Timestamp;
}

export interface HelpRequest extends RequestFields {
  ref: DocumentReference;
}

export interface Inbox {
  loading: boolean;
  circleCount: number;
  requests: HelpRequest[];
}

function watchInvites(db: Firestore, user: User, onError: (error: unknown) => void): Unsubscribe {
  if (!user.emailVerified || !user.email) return () => {};

  const email = user.email.toLowerCase();
  const pending = query(
    collection(db, "circles"),
    where("contactEmail", "==", email),
    where("contactUid", "==", null),
  );
  const claiming = new Set<string>();

  async function claim(ref: DocumentReference) {
    try {
      await runTransaction(db, async (transaction) => {
        const circle = (await transaction.get(ref)).data();
        if (circle?.contactUid === null && circle.contactEmail === email) {
          transaction.update(ref, { contactUid: user.uid });
        }
      });
    } catch (error) {
      if (!(error instanceof FirebaseError) || error.code !== "permission-denied") throw error;
      // A pending invite can disappear while this tab is trying to claim it.
      const current = await getDocsFromServer(pending);
      if (current.docs.some((invite) => invite.id === ref.id)) throw error;
    }
  }

  return onSnapshot(pending, (snapshot) => {
    for (const invite of snapshot.docs) {
      if (invite.id === user.uid || claiming.has(invite.id)) continue;
      claiming.add(invite.id);
      void claim(invite.ref).catch(onError).finally(() => claiming.delete(invite.id));
    }
  }, onError);
}

export function watchInbox(
  db: Firestore,
  user: User,
  onInbox: (inbox: Inbox) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const circles = new Map<string, { stop: Unsubscribe; requests?: HelpRequest[] }>();
  const linked = query(collection(db, "circles"), where("contactUid", "==", user.uid));

  function publish() {
    const current = [...circles.values()];
    const requests = current.flatMap((circle) => circle.requests ?? []).sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    });
    onInbox({
      loading: current.some((circle) => circle.requests === undefined),
      circleCount: current.length,
      requests,
    });
  }

  const stopInvites = watchInvites(db, user, onError);
  const stopCircles = onSnapshot(linked, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache) return;
    for (const [id, circle] of circles) {
      if (!snapshot.docs.some((entry) => entry.id === id)) {
        circle.stop();
        circles.delete(id);
      }
    }

    for (const { id } of snapshot.docs) {
      if (circles.has(id)) continue;
      const recent = query(collection(db, "circles", id, "requests"), orderBy("createdAt", "desc"));
      const stop = onSnapshot(recent, { includeMetadataChanges: true }, (requests) => {
        if (requests.metadata.fromCache || requests.metadata.hasPendingWrites) return;
        circles.set(id, {
          stop,
          requests: requests.docs.map((entry) => ({
            ...(entry.data() as RequestFields),
            ref: entry.ref,
          })),
        });
        publish();
      }, onError);
      circles.set(id, { stop });
    }

    publish();
  }, onError);

  return () => {
    stopInvites();
    stopCircles();
    for (const circle of circles.values()) circle.stop();
  };
}

export function sendReply(ref: DocumentReference, reply: Reply) {
  return updateDoc(ref, { ...reply, status: "replied", repliedAt: serverTimestamp() });
}
