import { messageLimit, screenPrivateText } from "@bifocal/core";
import { defineBackground } from "wxt/utils/define-background";
import type { Card, CheckNotice, ExtensionMessage, MessageSnapshot } from "../lib/card";
import { cardKey, contactKey } from "../lib/card";
import { pageCheckScript, pageOrigins } from "../lib/page-checks";

const badge = {
  none: { text: "OK", color: "#23624d" },
  suspicious: { text: "!", color: "#8a5705" },
  high: { text: "!", color: "#9c2e34" },
};

export default defineBackground(() => {
  const queues = new Map<number, Promise<unknown>>();
  const links = new Map<number, { href: string; expires: number }>();

  function notice(card: Card): CheckNotice {
    return { id: card.id, flagged: card.result.screening.tier !== "none", fromFlaggedLink: !!card.fromFlaggedLink };
  }

  function inOrder<T>(tabId: number, work: () => Promise<T>) {
    const next = (queues.get(tabId) ?? Promise.resolve()).catch(() => undefined).then(work);
    queues.set(tabId, next);
    const done = () => { if (queues.get(tabId) === next) queues.delete(tabId); };
    void next.then(done, done);
    return next;
  }

  async function getCard(tabId: number): Promise<Card | undefined> {
    const key = cardKey(tabId);
    const stored = await chrome.storage.session.get(key);
    return stored[key] as Card | undefined;
  }

  async function save(tabId: number, card?: Card, refreshContent = false) {
    const key = cardKey(tabId);
    if (card) {
      await chrome.storage.session.set({ [key]: card });
      const { text, color } = badge[card.result.screening.tier];
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
      await chrome.action.setBadgeText({ tabId, text });
    } else {
      await chrome.storage.session.remove([key, contactKey(tabId)]);
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
    if (refreshContent) {
      void chrome.tabs.sendMessage(tabId, { type: "check-notice", notice: card ? notice(card) : null } satisfies ExtensionMessage)
        .catch(() => undefined);
    }
  }

  async function receive(tabId: number, snapshot: MessageSnapshot | null, href?: string) {
    if (!snapshot) return save(tabId);
    if (typeof snapshot.text !== "string" || !snapshot.text.trim()) return;
    const text = snapshot.text.slice(0, messageLimit);
    const senderEmail = snapshot.senderEmail?.slice(0, 254);
    const current = await getCard(tabId);
    if (current?.text === text && current.sourceId === snapshot.sourceId && current.channel === snapshot.channel && current.senderEmail === senderEmail) {
      return notice(current);
    }

    // The Prompt API lives in the side panel. The worker can always run the local rules.
    const result = await screenPrivateText(text, async () => { throw new Error("No model in the worker"); });
    const link = links.get(tabId);
    const fromFlaggedLink = snapshot.channel === "web" && !!link && Date.now() < link.expires &&
      !!href && link.href.split("#")[0] === href.split("#")[0];
    const card = { ...snapshot, text, senderEmail, id: crypto.randomUUID(), result, fromFlaggedLink, privateCheckFinished: false };
    await save(tabId, card);
    return notice(card);
  }

  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  chrome.tabs.onRemoved.addListener((tabId) => {
    links.delete(tabId);
    void inOrder(tabId, () => chrome.storage.session.remove([cardKey(tabId), contactKey(tabId)])).catch(() => undefined);
  });
  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id === undefined || tab.openerTabId === undefined) return;
    const link = links.get(tab.openerTabId);
    if (link && Date.now() < link.expires) links.set(tab.id, link);
  });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === "loading") void inOrder(tabId, () => save(tabId)).catch(() => undefined);
  });
  chrome.permissions.onRemoved.addListener(({ origins }) => {
    if (!origins?.some((origin) => pageOrigins.includes(origin))) return;
    void chrome.scripting.unregisterContentScripts({ ids: [pageCheckScript] }).catch(() => undefined);
    void chrome.tabs.query({}).then((tabs) => Promise.allSettled(tabs.flatMap(({ id }) => id === undefined ? [] : [
      chrome.tabs.sendMessage(id, { type: "page-checks-disabled" } satisfies ExtensionMessage),
    ]))).catch(() => undefined);
  });

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, reply) => {
    const tabId = sender.tab?.id;
    if (tabId !== undefined && sender.frameId === 0 && !sender.url?.startsWith(chrome.runtime.getURL(""))) {
      if (message.type === "show-card") {
        if (message.contact) void chrome.storage.session.set({ [contactKey(tabId)]: true });
        void chrome.sidePanel.open({ tabId }).then(() => reply(true), () => reply(false));
        return true;
      }
      if (message.type === "flagged-link" && /^https?:\/\//.test(message.href)) {
        // Navigation may start before the next storage read completes.
        links.set(tabId, { href: message.href, expires: Date.now() + 60_000 });
        return;
      }
      if (message.type === "pause-choice") {
        void inOrder(tabId, async () => {
          await chrome.storage.session.set({ lastPause: { choice: message.choice, at: Date.now() } });
        }).catch(() => undefined);
        return;
      }
      if (message.type !== "snapshot") return;
      const origin = sender.origin;
      const channel = origin === "https://mail.google.com" ? "email"
        : origin === "https://messages.google.com" ? "sms" : "web";
      if (message.snapshot && message.snapshot.channel !== channel) return;
      void inOrder(tabId, () => receive(tabId, message.snapshot, sender.url)).then(reply, () => reply(null));
      return true;
    }
    if (sender.url !== chrome.runtime.getURL("sidepanel.html")) return;
    if (message.type !== "private-result" && message.type !== "request-sent") return;
    void inOrder(message.tabId, async () => {
      const current = await getCard(message.tabId);
      if (current?.id !== message.cardId) return;
      if (message.type === "private-result" && message.result.source !== "cloud") {
        await save(message.tabId, { ...current, result: message.result, privateCheckFinished: true }, true);
      } else if (message.type === "request-sent") {
        await save(message.tabId, { ...current, request: { uid: message.uid, id: message.requestId } });
      }
    }).then(() => reply(true), () => reply(false));
    return true;
  });
});
