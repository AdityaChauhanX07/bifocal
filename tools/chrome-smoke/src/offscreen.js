import { runCheck } from "./inference.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "run-offscreen-check" || sender.id !== chrome.runtime.id) return;

  runCheck().then(sendResponse, (error) => sendResponse({ error: error.message }));
  return true;
});
