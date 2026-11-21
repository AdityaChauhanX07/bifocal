const offscreenPage = "offscreen.html";
let creating;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function runOffscreenCheck() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(offscreenPage)],
  });

  if (!contexts.length) {
    creating ??= chrome.offscreen
      .createDocument({
        url: offscreenPage,
        reasons: ["TESTING"],
        justification: "Check whether Gemini Nano runs in the offscreen document.",
      })
      .finally(() => {
        creating = undefined;
      });

    await creating;
  }

  return chrome.runtime.sendMessage({ type: "run-offscreen-check" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "request-offscreen-check" || sender.id !== chrome.runtime.id) return;

  runOffscreenCheck().then(sendResponse, (error) => sendResponse({ error: error.message }));
  return true;
});
