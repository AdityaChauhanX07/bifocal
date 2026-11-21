export type IncomingMessage = {
  conversationId: string;
  messageId: string;
  sender: string | null;
  text: string;
};

const origin = "https://messages.google.com";
const conversationPath = /^\/web\/(?:u\/\d+\/)?conversations\/([a-z0-9_-]+)\/?$/i;
const hidden = "[hidden], [inert]";
const wrapper = "mws-message-wrapper";
const textPart = "mws-text-message-part";
const content = "[data-e2e-text-message-content]";
const decorations = "mws-link-preview-decorator, mws-message-actions, mw-message-reactions-display";
const maxTextLength = 6_000;

function visible(element: Element) {
  return !element.closest(hidden) && (element.checkVisibility?.({ visibilityProperty: true }) ?? true);
}

function labelOf(element: HTMLElement | null) {
  const firstLine = (element?.innerText ?? element?.textContent ?? "").trim().split("\n")[0];
  return firstLine.replace(/\s+/g, " ");
}

function readBody(element: Element) {
  const chunks: string[] = [];

  function append(node: Node) {
    if (node.nodeType === node.TEXT_NODE) {
      chunks.push(node.nodeValue ?? "");
    } else if (node.nodeType === node.ELEMENT_NODE) {
      const child = node as Element;
      if (child.matches(hidden + ", " + decorations + ", script, style, button")) return;
      if (child.localName === "br") chunks.push("\n");
      else child.childNodes.forEach(append);
    }
  }

  append(element);
  return chunks.join("").trim();
}

export function readLatestIncomingMessage(page: Document): IncomingMessage | null {
  if (page.location?.origin !== origin) return null;
  const path = page.location.pathname;
  const match = conversationPath.exec(path);
  if (!match || match[1].toLowerCase() === "new") return null;
  const conversationId = match[1];

  const panes = Array.from(page.querySelectorAll("mw-conversation-container")).filter(
    (pane) => visible(pane) && !pane.closest('[aria-hidden="true"]'),
  );
  if (panes.length !== 1) return null;

  const pane = panes[0];
  const list = pane.querySelector("mws-messages-list");
  if (!list || !visible(list)) return null;

  const header = pane.querySelector<HTMLElement>("mw-conversation-header, mws-header");
  const title = labelOf(
    header?.querySelector<HTMLElement>('[role="heading"], h1, h2') ?? header,
  );
  const link = page.querySelector(
    'a[data-e2e-conversation][href="' + path + '"], ' +
      'a[data-e2e-conversation][href="/web/conversations/' + conversationId + '"]',
  );
  const selectedName = labelOf(link?.querySelector<HTMLElement>("[data-e2e-conversation-name]") ?? null);

  // Angular can update the URL before it replaces the previous conversation.
  if (selectedName && title && selectedName !== title) return null;

  const messages = list.querySelectorAll(wrapper);
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    const direction = message.getAttribute("is-outgoing");
    if ((direction !== "false" && direction !== null) || !visible(message)) continue;

    const core = message.querySelector("[data-e2e-message-wrapper-core]");
    const messageId = message.getAttribute("msg-id") || core?.getAttribute("data-e2e-message-id");
    if (!messageId) continue;

    const textParts = Array.from(message.querySelectorAll(textPart)).filter(visible);
    if (!textParts.length) continue;

    const aria = textParts[0].getAttribute("aria-label") ?? "";
    const speaker = /^\s*([^\n:]{1,120}?)\s+said\s*:/i.exec(aria)?.[1];
    const sender = speaker && !/^you$/i.test(speaker) ? speaker : null;
    if (direction === null && !(sender && /\.\s+Received on\b/i.test(aria))) continue;

    const text = textParts
      .map((part) => part.querySelector(content) ?? part.querySelector("mws-message-part-content"))
      .filter((body): body is Element => body !== null && visible(body))
      .map(readBody)
      .filter(Boolean)
      .join("\n")
      .slice(0, maxTextLength);
    if (text) return { conversationId, messageId, sender: sender ?? (title || null), text };
  }

  return null;
}

function sameMessage(first: IncomingMessage | null, second: IncomingMessage | null) {
  if (!first || !second) return first === second;
  return first.conversationId === second.conversationId &&
    first.messageId === second.messageId &&
    first.sender === second.sender &&
    first.text === second.text;
}

export function observeIncomingMessages(
  page: Document,
  onMessage: (message: IncomingMessage | null) => void,
) {
  const view = page.defaultView;
  if (!view) throw new Error("Google Messages needs an active document");

  let previous: IncomingMessage | null | undefined;
  let frame: number | undefined;

  function refresh() {
    frame = undefined;
    const message = readLatestIncomingMessage(page);
    if (previous !== undefined && sameMessage(previous, message)) return;
    previous = message;
    onMessage(message);
  }

  const schedule = () => {
    frame ??= view.requestAnimationFrame(refresh);
  };

  const observer = new view.MutationObserver(schedule);
  observer.observe(page, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "msg-id", "is-outgoing", "data-e2e-message-id", "aria-label", "aria-hidden", "hidden", "inert",
    ],
  });
  view.addEventListener("popstate", schedule);
  schedule();

  return () => {
    observer.disconnect();
    view.removeEventListener("popstate", schedule);
    if (frame !== undefined) view.cancelAnimationFrame(frame);
  };
}
