# Chrome offline check

This test extension runs a synthetic gift-card message through Firebase AI Logic in `ONLY_ON_DEVICE` mode. Chrome's extension content security policy blocks network connections. The check requires an installed Gemini Nano model and a Chrome profile where the Prompt API is available.

1. Save the Firebase Web app's SDK configuration as `tools/chrome-smoke/firebase.local.json`.
2. With Node.js 24.12 or later, run `npm --prefix tools/chrome-smoke ci` and `npm --prefix tools/chrome-smoke run build`.
3. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and select `tools/chrome-smoke/dist`.
4. Open **Bifocal Offline Check** from the toolbar's extensions menu. Disconnect the computer from the internet and click **Test offscreen**. If the offscreen document reports that the Prompt API is unavailable, click **Test side panel** instead.

A passing result includes `inferenceSource: "on_device"` and a screening object accepted by `@bifocal/core`. The panel also reports Chrome's network status and inference time. This checks inference and schema validation. Google sign-in and live App Check token issuance have separate tests.
