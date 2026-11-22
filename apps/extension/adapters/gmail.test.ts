import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { readOpenEmail } from "./gmail.ts";

test("screens only the latest visible message in the open conversation", () => {
  const { document } = new JSDOM(`
    <aside>Unopened inbox snippets</aside>
    <div role="main">
      <h2 class="hP">Account review</h2>
      <div data-message-id="earlier" hidden><div class="a3s">Collapsed message</div></div>
      <div data-message-id="latest">
        <span class="gD" email="notice@sample.example">Sample Bank</span>
        <div class="a3s">Call the number on your card.</div>
      </div>
      <div contenteditable="true">Unsent draft</div>
    </div>`, { url: "https://mail.google.com/mail/u/0/#inbox/thread12345678" }).window;

  assert.deepEqual(readOpenEmail(document), {
    channel: "email",
    sourceId: "latest",
    senderEmail: "notice@sample.example",
    text: "From: notice@sample.example\nSubject: Account review\nCall the number on your card.",
  });
});

test("does not treat the inbox or an empty message as an open conversation", () => {
  const { document } = new JSDOM('<div role="main"><h2 class="hP">Inbox</h2>Unread summaries</div>', {
    url: "https://mail.google.com/mail/u/0/#inbox",
  }).window;
  assert.equal(readOpenEmail(document), null);
});
