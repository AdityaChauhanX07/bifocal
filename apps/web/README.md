# Trusted-contact dashboard

The dashboard links pending invitations to a verified Google email. Once linked, the contact can see requests as they arrive and send a preset reply or a short note.

## Run locally

Use Node.js 24.12+ and Java 21+. Vite needs a checkout path without a `#` character. From the repository root, install dependencies and start the emulators in one terminal.

```sh
npm ci
npx firebase-tools@15.37.0 emulators:start --only auth,firestore --project demo-bifocal
```

Start the dashboard in a second terminal, then open the local URL Vite prints.

```sh
npm run dev -w @bifocal/web
```

**Sign in with Google** opens the Authentication emulator's account picker. Use the same email that the invite's owner saved in `contactEmail`. Requests appear as soon as the app claims the invite and a request exists in that circle. The Firestore fields are documented in [the Firestore contract](../../firebase/README.md).

## Build for Firebase

Copy `.env.example` to `.env.local` in this directory and fill in the Firebase web app settings from **Project settings** → **General** → **Your apps**. To use App Check, register the web app with reCAPTCHA Enterprise in Firebase App Check and set `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Add the served hostname under **Authentication** → **Settings** → **Authorized domains** if Firebase does not already list it.

Run `npm run build -w @bifocal/web` from the repository root. The static build is in `apps/web/dist` and requires the project's Firestore rules. Production builds use the supplied Firebase config. The dev server uses the local emulators by default.

## Web push setup

1. In Firebase **Project settings**, open **Cloud Messaging**. Under **Web configuration** → **Web Push certificates**, generate a key pair if the project does not have one.
2. Set `VITE_FIREBASE_VAPID_KEY` in `.env.local` to the public key shown in the console. Set `VITE_FIREBASE_MESSAGING_SENDER_ID` to the `messagingSenderId` from the web app's SDK configuration. Make sure the project has the FCM Registration API enabled.
3. Rebuild and serve the dashboard over HTTPS. Keep `firebase-messaging-sw.js` at the root of the served site alongside the dashboard. Deploy the notification trigger using the [function instructions](../../functions/README.md#trusted-contact-notifications).
4. On the receiving device, open the dashboard, sign in with the invited Google account, and let it link the circle. Tap **Allow notifications**, then **Allow** in the browser prompt. On iPhone or iPad, add the dashboard to the Home Screen and open it there before enabling notifications.
5. Put the dashboard in the background and send a new help request from the protected user's account. Tap the phone alert to open the dashboard.

The account receives push on the most recently registered device. **Turn off notifications** and **Sign out** remove this device's registration if it's still the active one. Open dashboards also announce new requests in the page, including in local emulator sessions.
