import assert from "node:assert/strict";
import test from "node:test";
import { watchInbox, sendReply } from "../../web/src/requests.ts";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { connectFirestoreEmulator, getDocFromServer, getFirestore } from "firebase/firestore";
import { requestRef, saveInvitation, sendRequest, watchCircle, watchReply } from "./store.ts";
import { draftRequest } from "./summary.ts";

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(authHost && firestoreHost, "Start the Auth and Firestore emulators with project demo-bifocal.");
const firestoreUrl = new URL("http://" + firestoreHost);

async function account(sub: string, email: string) {
  const app = initializeApp({ apiKey: "demo-bifocal", projectId: "demo-bifocal" }, sub);
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://" + authHost, { disableWarnings: true });
    const db = getFirestore(app);
    connectFirestoreEmulator(db, firestoreUrl.hostname, Number(firestoreUrl.port));

    const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(
      JSON.stringify({ sub, email, email_verified: true }),
    ));
    return { app, db, user };
  } catch (error) {
    await deleteApp(app);
    throw error;
  }
}

test("a dashboard contact claims the invitation, receives one request, and replies", { timeout: 20_000 }, async () => {
  const owner = await account("request-owner", "owner@example.test");
  const contact = await account("request-contact", "contact@example.test");
  const { db, user } = owner;
  const subscriptions: (() => void)[] = [];

  try {
    await saveInvitation(db, user.uid, " CONTACT@EXAMPLE.TEST ");
    const request = requestRef(db, user.uid);
    const draft = draftRequest({ tier: "high", tactics: ["gift_card_payment"] }, "sms");

    await assert.rejects(sendRequest(request, draft), { code: "permission-denied" });

    const linked = Promise.withResolvers<void>();
    const received = Promise.withResolvers<Parameters<typeof sendReply>[0]>();
    subscriptions.push(
      watchCircle(db, user.uid, (circle) => {
        if (circle?.contactUid === contact.user.uid) linked.resolve();
      }, () => linked.reject(new Error("Owner could not read the circle"))),
      watchInbox(contact.db, contact.user, ({ requests }) => {
        if (requests.length > 0) received.resolve(requests[0].ref);
      }, received.reject),
    );
    await Promise.race([linked.promise, received.promise]);
    assert.equal((await getDocFromServer(request)).exists(), false);
    await Promise.all([sendRequest(request, draft), sendRequest(request, draft)]);

    const receivedRef = await received.promise;
    assert.equal(receivedRef.path, request.path);
    const saved = (await getDocFromServer(request)).data();
    assert.deepEqual(Object.keys(saved ?? {}).sort(), ["channel", "createdAt", "status", "summary", "tactics", "tier"]);
    assert.equal(saved?.summary, draft.summary);

    const reply = Promise.withResolvers<string | undefined>();
    subscriptions.push(watchReply(request, (current) => {
      if (current) reply.resolve(current.replyPreset);
    }, () => reply.reject(new Error("Owner could not read the reply"))));
    await sendReply(receivedRef, { replyPreset: "call_me" });
    assert.equal(await reply.promise, "call_me");
    await sendRequest(request, draft);
    assert.equal((await getDocFromServer(request)).data()?.status, "replied");

  } finally {
    subscriptions.forEach((stop) => stop());
    await Promise.all([deleteApp(owner.app), deleteApp(contact.app)]);
  }
});
