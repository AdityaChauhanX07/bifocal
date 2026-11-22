import type { CheckNotice, ExtensionMessage, MessageSnapshot } from "./card";

export function showChecks(
  ctx: { onInvalidated(callback: () => void): void },
  onNotice?: (notice: CheckNotice | null) => void,
) {
  let previous: string | undefined;
  let notice: HTMLElement | undefined;
  let revision = 0;
  let currentNotice: CheckNotice | null = null;
  let dismissedId: string | undefined;

  function hideNotice() {
    notice?.remove();
    notice = undefined;
  }

  function showNotice() {
    if (notice) return;
    notice = document.createElement("bifocal-notice");
    const root = notice.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
        max-width: calc(100vw - 40px); color: #172b42; font: 18px/1.4 system-ui, sans-serif; }
      section { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 16px;
        background: #fffcf4; border: 1px solid #a67527; border-radius: 12px; box-shadow: 0 3px 14px #172b4233; }
      button { font: inherit; color: inherit; min-height: 44px; background: transparent; cursor: pointer;
        border: 0; text-decoration: underline; }
    `;
    const banner = document.createElement("section");
    banner.setAttribute("role", "status");
    banner.append("Bifocal found warning signs.");
    const open = document.createElement("button");
    open.textContent = "See why";
    open.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      void chrome.runtime.sendMessage({ type: "show-card" } satisfies ExtensionMessage).catch(() => undefined);
    });
    const close = document.createElement("button");
    close.textContent = "Dismiss";
    close.addEventListener("click", () => { dismissedId = currentNotice?.id; hideNotice(); });
    banner.append(open, close);
    root.append(style, banner);
    document.body.append(notice);
  }

  function update(next: CheckNotice | null) {
    currentNotice = next;
    onNotice?.(next);
    if (next?.flagged && next.id !== dismissedId) showNotice();
    else hideNotice();
  }

  function receive(message: ExtensionMessage) {
    if (message.type === "check-notice") update(message.notice);
  }

  function followLink(event: MouseEvent) {
    if (!event.isTrusted || !currentNotice?.flagged) return;
    const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
    if (!link || !/^https?:$/i.test(link.protocol)) return;
    void chrome.runtime.sendMessage({ type: "flagged-link", href: link.href } satisfies ExtensionMessage).catch(() => undefined);
  }

  chrome.runtime.onMessage.addListener(receive);
  if (!onNotice) document.addEventListener("click", followLink, true);
  ctx.onInvalidated(() => {
    chrome.runtime.onMessage.removeListener(receive);
    document.removeEventListener("click", followLink, true);
    hideNotice();
  });
  return (snapshot: MessageSnapshot | null) => {
    const next = JSON.stringify(snapshot);
    if (next === previous) return;
    previous = next;
    const current = ++revision;
    update(null);
    void chrome.runtime.sendMessage({ type: "snapshot", snapshot } satisfies ExtensionMessage)
      .then((notice: CheckNotice | null) => {
        if (revision === current) update(notice ?? null);
      }).catch(() => undefined);
  };
}
