import { defineContentScript } from "wxt/utils/define-content-script";
import { defaultPageSettings, pageOrigins, pageSettingsKey } from "../lib/page-checks";
import type { ExtensionMessage } from "../lib/card";
import { watchPause } from "../lib/pause";
import { readRiskyPage } from "../lib/risky-page";
import { showChecks } from "../lib/show-checks";
import { watchPage } from "../lib/watch-page";

export default defineContentScript({
  matches: pageOrigins,
  registration: "runtime",
  main(ctx) {
    let settings = defaultPageSettings;
    let enabled = true;
    const updatePause = watchPause(ctx, () => enabled ? settings : { ...settings, triggers: [] });
    const check = showChecks(ctx, updatePause);
    const refresh = () => check(enabled ? readRiskyPage(document, settings) : null);
    const update = (next: unknown) => {
      settings = (next as typeof defaultPageSettings | undefined) ?? defaultPageSettings;
      refresh();
    };
    const onSettings = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && pageSettingsKey in changes) update(changes[pageSettingsKey].newValue);
    };
    const onMessage = (message: ExtensionMessage, _sender: chrome.runtime.MessageSender, reply: (ready: boolean) => void) => {
      if (message.type === "page-checks-disabled") { enabled = false; refresh(); }
      if (message.type === "check-page") {
        enabled = true;
        refresh();
        reply(true);
      }
    };
    chrome.storage.onChanged.addListener(onSettings);
    chrome.runtime.onMessage.addListener(onMessage);
    void chrome.storage.local.get(pageSettingsKey).then((stored) => update(stored[pageSettingsKey]));
    ctx.onInvalidated(watchPage(refresh));
    ctx.onInvalidated(() => {
      chrome.storage.onChanged.removeListener(onSettings);
      chrome.runtime.onMessage.removeListener(onMessage);
    });
  },
});
