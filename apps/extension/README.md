# Bifocal for Chrome

Use desktop Chrome 139 or later. Open `chrome://extensions`, turn on **Developer mode**, then use **Load unpacked** to select the folder that contains the built `manifest.json`. Open **Bifocal** from Chrome’s Extensions menu and keep its side panel open while trying a message.

## Build from source

Use Node.js 24.12 or later. If the checkout path contains `#`, the build installs the locked extension dependencies in a temporary workspace and copies the finished output back.

```sh
npm ci
npm run build -w "@bifocal/extension"
npm run zip -w "@bifocal/extension"
```

The unpacked build goes to `apps/extension/.output/chrome-mv3`. The `bifocal-<version>-chrome.zip` goes in the same `.output` directory. The ZIP command also builds the unpacked extension. Extract the ZIP before selecting its folder in Chrome.

## Check the local flow

1. Reload Gmail or Google Messages if it was open during installation. Open a fictional email or text asking the reader to buy a gift card and send the code.
2. Open the Bifocal side panel and check the warning, quote and next step. The toolbar badge uses a basic check with the panel closed. The panel can upgrade the result using Gemini Nano. If needed, open **Settings** and choose **Get Bifocal ready** to download the model.
3. For Pause on other sites, open `/try` and follow **Practice Pause with the Chrome extension**. In Bifocal’s **Settings**, choose **Enable website checks** and grant site access in Chrome. If already enabled, choose **Check this tab**. Once Bifocal reports that website checks are active, click **Buy gift card**. A short hold leaves the dialog open. After a five-second hold, the page lets the user retry the action themselves. [Judge walkthrough](../../docs/judge-demo.md)
4. For an offline check, open your fictional message first and wait for Chrome to finish downloading the model. Disconnect, then open a different fictional message already loaded in the same tab. Look for **Checked privately on this computer**. **Basic check only** means the on-device model did not return a valid screening.

Message text and risk cards live in Chrome's session storage until the page changes or the browser closes. Pause stores the last choice and its time in the same session. Website checks are opt-in and read visible page text on pages with supported signals. They exclude typed field values. This first version checks the top-level document. Embedded payment widgets and links that redirect away from the original destination can bypass a Pause trigger.

## Verified in desktop Chrome

- **Gmail.** Gemini Nano rated a fictional gift-card request **High risk**, quoted the request and flagged the secrecy instruction. Opening a separate fictional lunch email cleared the banner and showed **No obvious warning signs**.
- **Pause on a website.** In Bifocal 0.1.1, Gemini Nano flagged a local gift-card test page. Clicking **Buy gift card** opened Pause, and the tester reached the simulated checkout after holding to continue. A separate Chromium fixture run verified that a short hold keeps Pause open and that checkout requires another click after the full hold.

## Rehearse trusted contacts locally

With Node.js 24.12+ and Java 21+, build the emulator extension and dashboard from the repository root.

```sh
npm run build:emulator -w @bifocal/extension
npm run build:emulator -w @bifocal/web
```

Run the emulators and dashboard preview in separate terminals.

```sh
npx firebase-tools@15.37.0 emulators:start --only auth,firestore --project demo-bifocal
npm run preview:emulator -w @bifocal/web
```

1. Load `apps/extension/.output/chrome-mv3-emulator` and open **Bifocal (Emulator)**. On a fictional risk card, sign in as the demo owner and invite `contact@example.test`.
2. Open the dashboard preview at `http://127.0.0.1:4174/` and click **Sign in as demo contact**. The dashboard opens as `contact@example.test`.
3. Preview and send a request from the risk card. Reply in the dashboard, then close and reopen the side panel on the same message. The request opens with the reply visible.

The rehearsal uses the `demo-bifocal` project on loopback. Release artifacts use separate directories and the release Chrome ID. [Firebase Authentication emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)

## Enable signed-in features

1. Load the unpacked extension and check its ID at `chrome://extensions`. The release ZIP uses `pkbbjikifimobaddpajdcfckhmammbao` on every machine. Builds before 0.1.2 may appear as a separate extension. `WXT_EXTENSION_KEY` accepts a public manifest key when a build needs a different ID. [Chrome manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)
2. In Google Cloud Console, create a **Chrome Extension** OAuth client with that extension ID. Enable **Google** in Firebase Authentication and add `chrome-extension://<id>` to its authorized domains. If the OAuth consent screen is in testing, add both demo accounts as test users. [Firebase Chrome extension sign-in](https://firebase.google.com/docs/auth/web/chrome-extension) · [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity)
3. Copy `.env.example` to `.env.local` in `apps/extension`. Fill in the extension Firebase web app's SDK configuration and the OAuth client ID. Rebuild and reload the extension. A signed-in owner can invite a trusted contact by their Google email from a risk card. The contact opens the dashboard and signs in with that account to accept the invite.
4. Deploy the App Check endpoint with the matching extension origin and app ID, then set `WXT_APP_CHECK_URL` to its HTTPS URL. Firestore rules and phone push have their own deployment steps. [Firebase functions setup](../../functions/README.md)
5. After confirming the project is covered by Gemini's paid-service data terms, set `WXT_ENABLE_APPROVED_CLOUD=true` before rebuilding. **Check deeper** shows the exact redacted preview. **Send this text** screens that copy in the cloud. **Send and search** also enables Google Search grounding. **Why is this risky?** only uses the warning codes and tier. [Search grounding guidance](https://firebase.google.com/docs/ai-logic/grounding-google-search)

Remote Config has bundled defaults. The extension reads a new configuration while online and keeps local checks available during network failure. [Parameter template](../../firebase/remoteconfig.template.json)
