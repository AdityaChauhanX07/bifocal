import assert from "node:assert/strict";
import test from "node:test";
import { notifyTrustedContact } from "../src/request-push.js";

const fid = "c" + "1".repeat(21);
const newerFid = "d" + "2".repeat(21);
const dashboardUrl = "https://dashboard.example.test/";

function fixture({ status = "pending", contactUid = "contact", installation = fid } = {}) {
  let current = installation;
  const profile = { get: async () => ({ get: (field) => {
    assert.equal(field, "fcmInstallationId");
    return current;
  } }) };
  const updates = [];
  const firestore = {
    collection(name) {
      assert.equal(name, "users");
      return { doc(uid) { assert.equal(uid, contactUid); return profile; } };
    },
    runTransaction: (callback) => callback({
      get: (ref) => ref.get(),
      update(ref, fields) {
        assert.equal(ref, profile);
        updates.push(fields);
        current = undefined;
      },
    }),
  };
  const request = {
    path: "circles/private-owner/requests/private-request",
    firestore,
    get: async () => ({ get: (field) => {
      assert.equal(field, "status");
      return status;
    } }),
    parent: { parent: { get: async () => ({ get: (field) => {
      assert.equal(field, "contactUid");
      return contactUid;
    } }) } },
  };
  return { request, updates, replaceInstallation: (id) => { current = id; } };
}

test("routes a generic alert to the linked contact and coalesces duplicate deliveries", async () => {
  const { request } = fixture();
  const sent = [];
  const send = async (message) => { sent.push(message); };
  await notifyTrustedContact(request, { send, dashboardUrl });
  await notifyTrustedContact(request, { send, dashboardUrl });

  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);
  const message = sent[0];
  assert.equal(message.fid, fid);
  assert.deepEqual(message.webpush.fcmOptions, { link: dashboardUrl });
  assert.deepEqual(message.webpush.notification, {
    title: "Bifocal",
    body: "You have a new help request.",
    tag: message.webpush.headers.Topic,
    renotify: false,
  });
  assert.match(message.webpush.headers.Topic, /^[A-Za-z0-9_-]{32}$/);
  assert.doesNotMatch(JSON.stringify(message), /private-owner|private-request|summary|tier|tactics/);
});

test("skips requests without a linked contact or a valid registration and requests already answered", async () => {
  for (const overrides of [
    { contactUid: null }, { installation: null }, { installation: "not-an-installation" },
    { status: "replied" }, { status: null },
  ]) {
    const { request } = fixture(overrides);
    await notifyTrustedContact(request, { send: () => assert.fail("Unexpected push"), dashboardUrl });
  }
});

test("forgets stale installations only while the same ID is still saved", async () => {
  const expired = { code: "messaging/installation-id-not-registered" };
  const stale = fixture();
  await notifyTrustedContact(stale.request, { send: async () => { throw expired; }, dashboardUrl });
  assert.deepEqual(Object.keys(stale.updates[0]), ["fcmInstallationId"]);

  const rotated = fixture();
  await notifyTrustedContact(rotated.request, {
    send: async () => {
      rotated.replaceInstallation(newerFid);
      throw expired;
    },
    dashboardUrl,
  });
  assert.equal(rotated.updates.length, 0);
});

test("surfaces delivery errors without deleting the saved installation", async () => {
  const { request, updates } = fixture();
  const unavailable = { code: "messaging/server-unavailable" };
  await assert.rejects(
    notifyTrustedContact(request, { send: async () => { throw unavailable; }, dashboardUrl }),
    unavailable,
  );
  assert.equal(updates.length, 0);
});
