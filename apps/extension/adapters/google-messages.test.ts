import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { observeIncomingMessages, readLatestIncomingMessage } from "./google-messages.ts";

const messagesUrl = "https://messages.google.com/web/conversations/demo-101";

function openPage(body: string, url = messagesUrl) {
  return new JSDOM(body, { url, pretendToBeVisual: true });
}

function thread(messages: string, label = "Example Bank") {
  return `<mw-conversation-container>
    <mw-conversation-header><mws-header><h2>${label}</h2><button>Options</button></mws-header></mw-conversation-header>
    <mws-messages-list>${messages}</mws-messages-list>
  </mw-conversation-container>`;
}

function bubble(id: string, body: string, direction = 'is-outgoing="false"') {
  return `<mws-message-wrapper msg-id="${id}" ${direction}>
    <div data-e2e-message-wrapper-core>
      <mws-text-message-part><span data-e2e-text-message-content>${body}</span></mws-text-message-part>
    </div>
  </mws-message-wrapper>`;
}

test("reads only the latest incoming text from the active conversation", () => {
  const markup = `
    <aside><a data-e2e-conversation href="/web/conversations/other">Private inbox snippet</a></aside>
    <section hidden>${thread(bubble("other", "Text in another conversation"))}</section>
    ${thread(
      bubble("first", "Older text") +
      bubble("latest", "Payment due.<br>Call today.") +
      bubble("outgoing", "Outgoing message", 'is-outgoing="true"') +
      '<mws-message-wrapper msg-id="image" is-outgoing="false"><mws-image-message-part>image</mws-image-message-part></mws-message-wrapper>',
    )}
    <div contenteditable="true" data-e2e-message-input-box>Unsent draft</div>`;
  const { window } = openPage(markup);

  assert.deepEqual(readLatestIncomingMessage(window.document), {
    conversationId: "demo-101",
    messageId: "latest",
    sender: "Example Bank",
    text: "Payment due.\nCall today.",
  });
});

test("uses per-message sender and body markers in an active group", () => {
  const { window } = openPage(thread(`
    <mws-message-wrapper>
      <section data-e2e-message-wrapper-core data-e2e-message-id="group-text">
        <mws-text-message-part aria-label="Example Sender said: Call today. Received on August 16, 2026 at 4:43 PM.">
          <mws-message-part-content>Call today.<mws-link-preview-decorator>Link preview title</mws-link-preview-decorator></mws-message-part-content>
        </mws-text-message-part>
      </section>
    </mws-message-wrapper>
  `, "Neighbors"), "https://messages.google.com/web/u/1/conversations/demo-101");

  assert.deepEqual(readLatestIncomingMessage(window.document), {
    conversationId: "demo-101",
    messageId: "group-text",
    sender: "Example Sender",
    text: "Call today.",
  });
});

test("ignores messages whose direction is unknown and outgoing text from aria labels", () => {
  const { window } = openPage(thread(
    bubble("unknown", "Unknown direction", "") +
      '<mws-message-wrapper msg-id="sent"><mws-text-message-part aria-label="You said: Private draft. Sent on August 16, 2026"><span data-e2e-text-message-content>Private text</span></mws-text-message-part></mws-message-wrapper>',
  ));
  assert.equal(readLatestIncomingMessage(window.document), null);
});

test("ignores other origins, inactive routes, and ambiguous active panes", () => {
  const markup = thread(bubble("text", "Please call"));
  for (const url of [
    "https://example.test/web/conversations/demo-101",
    "https://messages.google.com/web/conversations",
    "https://messages.google.com/web/conversations/new",
  ]) {
    assert.equal(readLatestIncomingMessage(openPage(markup, url).window.document), null);
  }
  assert.equal(readLatestIncomingMessage(openPage(markup + markup).window.document), null);
});

test("waits for the open pane to match the selected conversation after navigation", () => {
  const markup = `
    <a data-e2e-conversation href="/web/conversations/demo-101">
      <span data-e2e-conversation-name>New Chat</span>
    </a>
    ${thread(bubble("stale", "Text from the previous chat"), "Previous Chat")}`;
  const { window } = openPage(markup);
  assert.equal(readLatestIncomingMessage(window.document), null);
});

test("limits the extracted body when a long RCS message exceeds the screening budget", () => {
  const { window } = openPage(thread(bubble("long", "A".repeat(6_200))));
  assert.equal(readLatestIncomingMessage(window.document)?.text.length, 6_000);
});

test("observes new incoming text once and clears the snapshot when the thread closes", async () => {
  const { window } = openPage(thread(bubble("first", "First incoming text")));
  const observed: (string | null)[] = [];
  const stop = observeIncomingMessages(window.document, (message) => {
    observed.push(message?.messageId ?? null);
  });
  const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  const list = window.document.querySelector("mws-messages-list")!;

  try {
    await nextFrame();
    list.append(window.document.createElement("mws-tombstone-message-wrapper"));
    await Promise.resolve();
    await nextFrame();
    assert.deepEqual(observed, ["first"]);

    list.insertAdjacentHTML("beforeend", bubble("new", "New incoming text"));
    await Promise.resolve();
    await nextFrame();
    list.closest("mw-conversation-container")!.remove();
    await Promise.resolve();
    await nextFrame();
    assert.deepEqual(observed, ["first", "new", null]);

    stop();
    window.document.body.insertAdjacentHTML("beforeend", thread(bubble("extra", "After detach")));
    await Promise.resolve();
    await nextFrame();
    assert.deepEqual(observed, ["first", "new", null]);
  } finally {
    stop();
    window.close();
  }
});
