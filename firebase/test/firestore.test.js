import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection, deleteField, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, setLogLevel, Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { screenSchema } from "../../packages/core/src/index.ts";

const ownerUid = "owner-fixture";
const contactUid = "contact-fixture";
const inviteEmail = "contact@example.test";
const circlePath = "circles/" + ownerUid;
const requestPath = circlePath + "/requests/request-fixture";
let environment;

setLogLevel("silent");

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-bifocal",
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

beforeEach(() => environment.clearFirestore());
after(() => environment?.cleanup());

function ownerDb() {
  return environment.authenticatedContext(ownerUid, {
    email: "owner@example.test",
    email_verified: true,
  }).firestore();
}

function contactDb(uid = contactUid, email = inviteEmail, verified = true) {
  return environment.authenticatedContext(uid, { email, email_verified: verified }).firestore();
}

function invite(contactEmail = inviteEmail) {
  return { protectedUid: ownerUid, contactEmail, contactUid: null, createdAt: serverTimestamp() };
}

function helpRequest(overrides = {}) {
  return {
    tier: "high",
    tactics: ["gift_card_payment"],
    summary: "The sender asked for a gift card as payment.",
    channel: "sms",
    createdAt: serverTimestamp(),
    status: "pending",
    ...overrides,
  };
}

async function linkContact(owner, contact) {
  await setDoc(doc(owner, circlePath), invite());
  await updateDoc(doc(contact, circlePath), { contactUid });
}

test("creates a single owner circle and permits correcting a pending email", async () => {
  const owner = ownerDb();
  await assertSucceeds(getDoc(doc(owner, circlePath)));
  await assertFails(setDoc(doc(owner, "circles/another-circle"), invite()));
  await assertFails(setDoc(doc(owner, circlePath), invite("CONTACT@example.test")));
  await assertFails(setDoc(doc(owner, circlePath), invite("owner@example.test")));
  await assertFails(setDoc(doc(owner, circlePath), { ...invite(), contactUid }));
  await assertSucceeds(setDoc(doc(owner, circlePath), invite("typo@example.test")));
  await assertSucceeds(updateDoc(doc(owner, circlePath), { contactEmail: inviteEmail }));
  await assertFails(updateDoc(doc(owner, circlePath), { protectedUid: contactUid }));
});

test("finds only pending invitations to the user's verified email", async () => {
  await setDoc(doc(ownerDb(), circlePath), invite());
  const other = contactDb("other-owner", "other-owner@example.test");
  await setDoc(doc(other, "circles/other-owner"), {
    ...invite("another-contact@example.test"),
    protectedUid: "other-owner",
  });
  const matching = contactDb(contactUid, "CONTACT@example.test");
  const wrongEmail = contactDb("wrong-fixture", "wrong@example.test");
  const unverified = contactDb("unverified-fixture", inviteEmail, false);
  const pending = (db) => query(
    collection(db, "circles"), where("contactEmail", "==", inviteEmail), where("contactUid", "==", null),
  );

  const invitations = await assertSucceeds(getDocs(pending(matching)));
  assert.deepEqual(invitations.docs.map((snap) => snap.id), [ownerUid]);
  await assertFails(getDocs(collection(matching, "circles")));
  await assertFails(getDocs(query(collection(matching, "circles"), where("contactEmail", "==", inviteEmail))));
  await assertFails(getDocs(pending(wrongEmail)));
  await assertFails(getDocs(pending(unverified)));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), circlePath)));
  await assertFails(getDoc(doc(matching, requestPath)));
});

test("only the invitee can claim their own UID and link their profile in a batch", async () => {
  const owner = ownerDb();
  const contact = contactDb();
  await setDoc(doc(owner, circlePath), invite());

  await assertFails(updateDoc(doc(owner, circlePath), { contactUid }));
  await assertFails(updateDoc(doc(contactDb("wrong-fixture", "wrong@example.test"), circlePath), { contactUid: "wrong-fixture" }));
  await assertFails(updateDoc(doc(contactDb(contactUid, inviteEmail, false), circlePath), { contactUid }));
  await assertFails(updateDoc(doc(contact, circlePath), { contactUid: "another-uid" }));
  await assertFails(updateDoc(doc(contact, circlePath), { contactUid, contactEmail: "new@example.test" }));

  const batch = writeBatch(contact);
  batch.update(doc(contact, circlePath), { contactUid });
  batch.set(doc(contact, "users/" + contactUid), {
    displayName: "Demo contact", role: "contact", circleId: ownerUid, createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  const linked = await assertSucceeds(getDocs(query(collection(contact, "circles"), where("contactUid", "==", contactUid))));
  assert.deepEqual(linked.docs.map((snap) => snap.id), [ownerUid]);
  await assertFails(updateDoc(doc(contactDb("other-uid", inviteEmail), circlePath), { contactUid: "other-uid" }));
  await assertFails(updateDoc(doc(owner, circlePath), { contactEmail: "new@example.test", contactUid: null }));
});

test("shares only the authenticated contact's name with the circle owner", async () => {
  const owner = ownerDb();
  const contactName = "Demo Contact";
  const namedContact = environment.authenticatedContext(contactUid, {
    email: inviteEmail, email_verified: true, name: contactName,
  }).firestore();
  const ref = doc(namedContact, circlePath);
  await setDoc(doc(owner, circlePath), invite());
  await assertFails(updateDoc(ref, { contactUid, contactName: "Other Person" }));
  await assertSucceeds(updateDoc(ref, { contactUid, contactName }));
  assert.equal((await getDoc(doc(owner, circlePath))).data().contactName, contactName);
  await assertFails(updateDoc(doc(owner, circlePath), { contactName: "Other Person" }));
  await assertFails(updateDoc(ref, { contactName: "Other Person" }));
  await assertFails(updateDoc(ref, { contactName: deleteField() }));
  await assertFails(updateDoc(ref, { contactName, contactEmail: "other@example.test" }));
});

test("keeps profiles and notification tokens private and checks claimed membership", async () => {
  const owner = ownerDb();
  const outsider = contactDb("outsider-fixture", "outside@example.test");
  const profile = {
    displayName: "Demo owner", role: "protected", fcmToken: "token-fixture", createdAt: serverTimestamp(),
  };
  await setDoc(doc(owner, "users/" + ownerUid), profile);
  await assertSucceeds(getDoc(doc(owner, "users/" + ownerUid)));
  await assertSucceeds(updateDoc(doc(owner, "users/" + ownerUid), { fcmToken: "replacement-fixture" }));
  await assertFails(getDoc(doc(outsider, "users/" + ownerUid)));
  await assertFails(getDocs(collection(owner, "users")));
  await assertFails(setDoc(doc(outsider, "users/" + ownerUid), profile));
  await assertFails(updateDoc(doc(owner, "users/" + ownerUid), { createdAt: Timestamp.fromMillis(0) }));
  await setDoc(doc(owner, circlePath), invite());
  await assertFails(setDoc(doc(outsider, "users/outsider-fixture"), {
    ...profile, role: "contact", circleId: ownerUid,
  }));
});

test("only a linked circle's owner can create requests and both members can read them", async () => {
  const owner = ownerDb();
  const contact = contactDb();
  const outsider = contactDb("outsider-fixture", "outside@example.test");
  await setDoc(doc(owner, circlePath), invite());
  await assertFails(setDoc(doc(owner, requestPath), helpRequest()));
  await updateDoc(doc(contact, circlePath), { contactUid });

  await assertFails(setDoc(doc(contact, requestPath), helpRequest()));
  await assertFails(setDoc(doc(outsider, requestPath), helpRequest()));
  await assertSucceeds(setDoc(doc(owner, requestPath), helpRequest()));
  await assertSucceeds(getDoc(doc(owner, requestPath)));
  await assertSucceeds(getDocs(collection(contact, circlePath, "requests")));
  await assertFails(getDoc(doc(outsider, requestPath)));
  await assertFails(getDocs(collection(outsider, circlePath, "requests")));
});

test("checks request fields, the shared tactic values, and the summary length and link rules", async () => {
  const owner = ownerDb();
  await linkContact(owner, contactDb());
  const request = doc(owner, requestPath);

  for (const summary of [
    "x".repeat(281),
    " ",
    "First line\nOpen HTTPS://example.test/offer",
    "Find the offer at example.test",
    "Write to inbox@example.test",
    "The page points to 192.0.2.25",
  ]) {
    await assertFails(setDoc(request, helpRequest({ summary })));
  }
  for (const extra of [
    { rawText: "A full message" }, { replyPreset: "call_me" }, { status: "replied" },
    { createdAt: Timestamp.fromMillis(0) }, { channel: "other" },
    { tactics: ["unsupported_tactic"] }, { tactics: [] }, { tier: "none" },
  ]) {
    await assertFails(setDoc(request, helpRequest(extra)));
  }

  await assertSucceeds(setDoc(request, helpRequest({
    tactics: screenSchema.properties.tactics.items.enum,
    summary: "x".repeat(280),
  })));
});

test("lets the linked contact send one reply while preserving the original request", async () => {
  const owner = ownerDb();
  const contact = contactDb();
  const outsider = contactDb("outsider-fixture", "outside@example.test");
  await linkContact(owner, contact);
  await setDoc(doc(owner, requestPath), helpRequest());
  const reply = { status: "replied", replyPreset: "call_bank", repliedAt: serverTimestamp() };

  await assertFails(updateDoc(doc(owner, requestPath), reply));
  await assertFails(updateDoc(doc(outsider, requestPath), reply));
  await assertFails(updateDoc(doc(contact, requestPath), { ...reply, summary: "Edited request" }));
  await assertFails(updateDoc(doc(contact, requestPath), { ...reply, replyPreset: "unrecognized" }));
  await assertFails(updateDoc(doc(contact, requestPath), { ...reply, replyNote: "Try www.example.test" }));
  await assertFails(updateDoc(doc(contact, requestPath), { ...reply, replyPreset: null }));
  await assertSucceeds(updateDoc(doc(contact, requestPath), reply));
  await assertFails(updateDoc(doc(contact, requestPath), { ...reply, replyPreset: "call_me" }));

  const answered = (await getDoc(doc(owner, requestPath))).data();
  assert.equal(answered.status, "replied");
  assert.equal(answered.replyPreset, "call_bank");
  assert.equal(answered.summary, helpRequest().summary);
});

test("accepts a short note as the reply on its own", async () => {
  const owner = ownerDb();
  const contact = contactDb();
  await linkContact(owner, contact);
  await setDoc(doc(owner, requestPath), helpRequest());
  await assertSucceeds(updateDoc(doc(contact, requestPath), {
    status: "replied", replyNote: "Please wait while I call you.", repliedAt: serverTimestamp(),
  }));
});

test("keeps push installations private and only accepts Firebase installation IDs", async () => {
  const contact = contactDb();
  const owner = ownerDb();
  const profile = doc(contact, "users/" + contactUid);
  const fid = "c" + "1".repeat(21);

  await assertSucceeds(setDoc(profile, {
    displayName: "Demo contact", role: "contact", createdAt: serverTimestamp(), fcmInstallationId: fid,
  }));
  await assertFails(getDoc(doc(owner, "users/" + contactUid)));
  await assertFails(updateDoc(doc(owner, "users/" + contactUid), { fcmInstallationId: "d" + "2".repeat(21) }));
  await assertFails(updateDoc(profile, { fcmInstallationId: "not-an-installation" }));
  await assertSucceeds(updateDoc(profile, { fcmInstallationId: deleteField() }));
});
