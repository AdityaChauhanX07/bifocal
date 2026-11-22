import type { ExtensionMessage } from "./card";

export const pageOrigins = ["https://*/*", "http://*/*"];
export const pageSettingsKey = "page-check-settings";
export const pageCheckScript = "bifocal-page-checks";

const scriptFile = "content-scripts/risky.js";
const messageSites = ["https://mail.google.com", "https://messages.google.com"];

export const defaultPageSettings = {
  triggers: ["card", "gift-card", "download"],
  tools: "anydesk,teamviewer,splashtop,connectwise,screenconnect,rustdesk,ultraviewer,logmein",
  signals: ["payment", "login", "gift-card", "download"],
};

export function registerPageChecks() {
  return chrome.scripting.registerContentScripts([{
    id: pageCheckScript,
    matches: pageOrigins,
    excludeMatches: messageSites.map((site) => `${site}/*`),
    js: [scriptFile],
    runAt: "document_idle",
  }]);
}

export async function checkWebsiteTab(tabId?: number) {
  if (tabId === undefined) return "choose-tab";
  const tab = await chrome.tabs.get(tabId);
  const url = URL.parse(tab.url ?? "");
  if (!url) return "access-needed";
  if (!/^https?:$/.test(url.protocol) || messageSites.includes(url.origin)) return "choose-tab";

  async function ping(id: number) {
    const answer: unknown = await chrome.tabs.sendMessage(id, { type: "check-page" } satisfies ExtensionMessage, {
      frameId: 0,
    }).catch(() => false);
    return answer === true;
  }

  if (await ping(tabId)) return "ready";
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [scriptFile] });
  } catch {
    return "access-needed";
  }
  return await ping(tabId) ? "ready" : "unavailable";
}
