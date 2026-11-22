import { messageLimit } from "@bifocal/core";
import type { MessageSnapshot } from "../lib/card.ts";

function visible(element: HTMLElement) {
  return !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    (element.checkVisibility?.({ visibilityProperty: true }) ?? true);
}

export function readOpenEmail(page: Document): MessageSnapshot | null {
  const main = page.querySelector<HTMLElement>('[role="main"]');
  if (!main) return null;
  const bodies = Array.from(main.querySelectorAll<HTMLElement>(".a3s, [data-message-body]"));
  const body = bodies.findLast(visible);
  const subject = main.querySelector<HTMLElement>("h2.hP, [data-thread-perm-id] h2");
  const message = body?.closest("[data-message-id], .adn");
  const header = message?.querySelector<HTMLElement>(".gD[email], [data-sender-email]");
  const senderEmail = header?.getAttribute("email") ?? header?.dataset.senderEmail ?? undefined;

  // Stay inside an opened conversation even if Gmail changes its message-body classes.
  const fallback = subject && /\/[a-z0-9]{12,}(?:[/?]|$)/i.test(page.location.hash) ? main : null;
  const content = body ?? fallback;
  const bodyText = (content?.innerText ?? content?.textContent ?? "").trim();
  if (!bodyText) return null;

  const text = [senderEmail && `From: ${senderEmail}`, subject?.textContent && `Subject: ${subject.textContent.trim()}`, bodyText]
    .filter(Boolean).join("\n").slice(0, messageLimit);
  return { channel: "email", text, senderEmail, sourceId: message?.getAttribute("data-message-id") ?? page.location.hash };
}
