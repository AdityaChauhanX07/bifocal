export const pageOrigins = ["https://*/*", "http://*/*"];
export const pageSettingsKey = "page-check-settings";
export const pageCheckScript = "bifocal-page-checks";

export const defaultPageSettings = {
  triggers: ["card", "gift-card", "download"],
  tools: "anydesk,teamviewer,splashtop,connectwise,screenconnect,rustdesk,ultraviewer,logmein",
  signals: ["payment", "login", "gift-card", "download"],
};

export function registerPageChecks() {
  return chrome.scripting.registerContentScripts([{
    id: pageCheckScript,
    matches: pageOrigins,
    excludeMatches: ["https://mail.google.com/*", "https://messages.google.com/*"],
    js: ["content-scripts/risky.js"],
    runAt: "document_idle",
  }]);
}
