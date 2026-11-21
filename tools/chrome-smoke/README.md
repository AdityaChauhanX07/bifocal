# Chrome offline check

This test extension runs a synthetic gift-card message through Firebase AI Logic in `ONLY_ON_DEVICE` mode. Chrome's extension content security policy blocks network connections. The check requires an installed Gemini Nano model and a Chrome profile where the Prompt API is available.

1. Save the Firebase Web app's SDK configuration as `tools/chrome-smoke/firebase.local.json`.
2. With Node.js 24.12 or later, run `npm --prefix tools/chrome-smoke ci` and `npm --prefix tools/chrome-smoke run build`.
3. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and select `tools/chrome-smoke/dist`.
4. Open **Bifocal Offline Check** from the toolbar's extensions menu. Disconnect the computer from the internet and click **Test side panel**. Reconnect after the result appears.

A passing result includes `inferenceSource: "on_device"`, `online: false` and a screening object accepted by `@bifocal/core`.

## Laptop A result

Chrome's side panel generated schema-valid JSON in 3,228 ms while offline. It classified the sample as high risk, identified gift-card payment and secrecy, and quoted the payment request exactly. This run verifies local inference in the side panel. Live App Check token issuance is still pending.

Chrome stopped the offscreen test at document creation. Its `TESTING` reason requires the [Chromium offscreen testing switch](https://chromium.googlesource.com/chromium/src/+/0db15a320f1a52e7922a9130c4a5273b0c99d60a/extensions/common/switches.cc). The side-panel check uses the standard Chrome launch.
