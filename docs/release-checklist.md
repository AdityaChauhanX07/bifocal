# Release checks

Run the signed-out demo in a fresh desktop Chrome profile. Use two test accounts for the signed-in flows and fictional messages throughout. Record the commit, Chrome version, and which model or fallback the result shows. Before recording, run the demo flow three times in a row.

## Build and check the signed-out demo

From the repository root, run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build:judge-demo`. The demo build writes the site to `apps/web/dist` and copies the local-only Chrome ZIP into its downloads folder. Load the site through Firebase Hosting or its Hosting emulator.

1. Open `/try`. Check **A text from a new number** and expect a gift-card warning. Check **A pickup reminder** and compare the result.
2. Download the ZIP from the page, extract it, and select the folder with `manifest.json` through **Load unpacked** at `chrome://extensions`. The extension ID is `pkbbjikifimobaddpajdcfckhmammbao`.
3. On the [test checkout](judge-demo.md#try-pause), enable website checks in Bifocal’s **Settings** or choose **Check this tab**. Click **Buy gift card**. Let go of the hold button early and confirm the dialog stays open. Hold for five seconds, click **Buy gift card** again, and look for **Test checkout reached**.
4. In Gmail, open a fictional email that says “Buy a gift card now and send me the code. Don’t tell anyone.” Then open an ordinary lunch message. Expect a warning on the first and no obvious warning signs on the second. For Google Messages for web, send the fictional request from a second demo device to the paired phone, then open the received text in the web conversation.
5. Use **Get Bifocal ready** if Chrome needs the model. Load the fictional messages before disconnecting. Open a different loaded message while offline and look for **Checked privately on this computer**.

## Test the no-cost cloud fallback

Keep the Firebase project on Spark. With the dashboard SDK configuration and reCAPTCHA Enterprise App Check site key in `apps/web/.env.local`, enable the **Anonymous** provider in Firebase Authentication. Build with `npm run build:judge-demo -- --spark-samples` and serve on the dashboard's authorized HTTPS hostname. The fictional message samples can then fall back to Gemini 3.5 Flash-Lite when Nano is unavailable. Pasted messages use the on-device model or the basic check. The public evaluation page runs only the on-device path. [Firebase pricing](https://firebase.google.com/docs/ai-logic/pricing) · [Gemini model pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)

To verify the fallback, open `/try` in a fresh Chrome profile without a ready local model, choose a fictional example, and look for **Checked with Google Gemini**. Then paste a fictional message and choose **Check privately**. Expect an on-device or basic result. Run the two bulk cloud evaluation paths from a separately configured build.

## Configure the signed-in build

Set up Firebase Web Apps for the dashboard and the extension. Copy the public SDK configuration into each app’s `.env.local`. Run `npm run firebase:preflight` and check the rows for the features being deployed. [Web setup](../apps/web/README.md#build-for-firebase) · [Extension setup](../apps/extension/README.md#enable-signed-in-features)

1. In Google Auth Platform, open **Clients → Create client**. Choose **Chrome Extension** and enter the release ID as the **Item ID**. Copy the generated Client ID into `WXT_GOOGLE_CLIENT_ID`. If the consent screen is in testing, add the demo accounts to its test-user list. Add the extension origin to Firebase Authentication’s authorized domains. [Chrome OAuth setup](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
2. Create the default Firestore database in Native mode. Deploy the tested rules before publishing the signed-in dashboard. Register the dashboard with reCAPTCHA Enterprise App Check and enable anonymous Auth for the signed-out web cloud samples. [Firestore rules](../firebase/README.md) · [Web App Check setup](../apps/web/README.md#enable-hosted-cloud-checks)
3. After approving Blaze billing and confirming Gemini paid-service coverage, deploy `mintAppCheckToken` and `notifyOnRequest` with the matching production settings. Set the mint function URL in `WXT_APP_CHECK_URL`. Confirm AI Logic App Check enforcement, authenticated-users mode, and per-user limits. Set the Web Push public key in the dashboard build. [Functions and preflight](../functions/README.md) · [Phone notifications](../apps/web/README.md#web-push-setup)
4. Enable the approved cloud checks in the extension and web build after the settings are verified. Rebuild and deploy the dashboard and reload the signed-in extension build.

## Verify the signed-in flows

1. Open an extension warning, sign in, and choose **Check deeper**. Look for the trusted contact’s name and email replaced by tags where they appear in the fictional message. Cancel one preview, reopen it, and choose **Send this text**. Expect a result labeled **Checked in the cloud with your permission**. Repeat with **Send and search** and confirm the sources and Google Search suggestions appear.
2. Under **Ask my trusted contact**, invite the second test account. Sign in on the HTTPS dashboard with that account. Send a request after reviewing its short summary. Reply on the dashboard and confirm the reply appears on the original risk card, including after reopening the panel.
3. On the contact’s phone, install the dashboard and allow notifications. Put the app in the background, send a new request, and open the dashboard from the alert.
4. Open hosted `/try` signed out and check a fictional sample. In `/eval`, run **Cloud · original text** and **Cloud · redacted text** on the 65 fictional held-out rows. Export the CSV, record valid rows and inference sources, then publish the comparison beside the on-device results. [Evaluation guide](../eval/README.md)
