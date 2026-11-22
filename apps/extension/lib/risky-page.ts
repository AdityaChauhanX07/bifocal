import { messageLimit } from "@bifocal/core";
import type { MessageSnapshot } from "./card.ts";
import { defaultPageSettings } from "./page-checks.ts";

const cardField = [
  '[autocomplete~="cc-number" i]', '[name="cardnumber" i]', '[name="card_number" i]',
  '[name="cc-number" i]', '[id="card-number" i]', '[data-testid="card-number"]',
].map((part) => `input${part}`).join(", ");
const giftCards = /\bgift[ -]cards?\b/i;
const purchaseAction = /\b(?:buy|checkout|purchase|add to (?:bag|cart)|continue to payment)\b/i;
const executable = /\.(?:exe|msi|dmg|pkg|scr|appx)$/i;

export type PauseReason = "card" | "gift-card" | "download";

export const pauseReasons: Record<PauseReason, string> = {
  card: "This page is asking for a card number after Bifocal spotted warning signs.",
  "gift-card": "This gift-card purchase follows warning signs Bifocal spotted.",
  download: "This download appears to be a tool that lets someone control your computer remotely.",
};

function visible(element: Element) {
  return !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    (element.checkVisibility?.({ visibilityProperty: true }) ?? true);
}

function looksLikeGiftCards(page: Document, text?: string) {
  return giftCards.test(`${page.title} ${page.location?.pathname} ${text?.slice(0, 2_000) ?? ""}`);
}

function remoteDownload(link: HTMLAnchorElement, tools: string) {
  const url = URL.parse(link.href);
  if (!url || !/^https?:$/.test(url.protocol)) return false;
  const name = `${url.hostname} ${url.pathname} ${link.download} ${link.textContent}`.toLowerCase();
  return (executable.test(url.pathname) || !!link.download) && tools.split(",").some((tool) => {
    const keyword = tool.trim().toLowerCase();
    return keyword.length > 2 && name.includes(keyword);
  });
}

export function readRiskyPage(page: Document, settings = defaultPageSettings): MessageSnapshot | null {
  const root = page.querySelector<HTMLElement>('main, [role="main"]') ?? page.body;
  if (!root) return null;
  const payment = settings.signals.includes("payment") && Array.from(page.querySelectorAll(cardField)).some(visible);
  const login = settings.signals.includes("login") && Array.from(page.querySelectorAll('input[type="password"]')).some(visible);
  const words = (root.innerText ?? root.textContent ?? "").trim();
  const gift = settings.signals.includes("gift-card") && looksLikeGiftCards(page, words);
  const download = settings.signals.includes("download") && Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]")).some((link) =>
    visible(link) && remoteDownload(link, settings.tools));
  if (!payment && !login && !gift && !download) return null;

  const url = new URL(page.location.href);
  const hint = download ? "Download remote access software" : "";
  const text = [page.title, `Site: ${url.origin}`, hint, words].filter(Boolean).join("\n").slice(0, messageLimit);
  return { text, channel: "web" };
}

export function pauseReason(target: HTMLElement, event: "focus" | "click", tools = defaultPageSettings.tools): PauseReason | undefined {
  if (event === "focus") return target.matches(cardField) ? "card" : undefined;
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (link && remoteDownload(link, tools)) return "download";
  const action = target.closest<HTMLElement>('button, a, [role="button"], input[type="submit"]');
  if (action && purchaseAction.test(`${action.textContent} ${action.getAttribute("value") ?? ""}`)) {
    const page = target.ownerDocument;
    const text = page.querySelector<HTMLElement>('main, [role="main"]')?.textContent ?? page.body.textContent;
    if (looksLikeGiftCards(page, text ?? "")) return "gift-card";
  }
}
