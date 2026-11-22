# App Check token endpoint

Run `npm --prefix functions ci` and `npm --prefix functions test` from the repository root with Node.js 22. The tests exercise the HTTP handler with test doubles for Firebase Auth and token signing.

The Chrome extension calls `mintAppCheckToken` with a POST and an `Authorization: Bearer <Firebase ID token>` header after Google sign-in. The JSON response has `token` and `expireTimeMillis`, the fields expected by the Firebase web `CustomProvider`. The request needs no body. The function rechecks the user's sign-in status and signs a token for the configured Firebase app with a 30-minute lifetime.

## Deployment settings

- `BIFOCAL_EXTENSION_ORIGIN` comes from the extension's ID in `chrome://extensions`. Use `chrome-extension://<id>` without a trailing slash.
- `BIFOCAL_EXTENSION_APP_ID` is the App ID of the Firebase Web app registered for the extension.
- The function's runtime service account needs permission to read Firebase Auth users and sign blobs as its signing service account. See the [Admin SDK signing guide](https://firebase.google.com/docs/auth/admin/create-custom-tokens#letting_the_admin_sdk_discover_a_service_account).
- Enable Firebase AI Logic App Check enforcement, authenticated-users mode and per-user rate limits before making cloud inference available.

The project alias `hackathon` points to the team's Firebase project. Deploying Cloud Functions requires Blaze. The caller check relies on verified Google sign-in and restricts browser requests to the configured extension origin. Chrome provides no binary attestation through this flow.

## Trusted-contact notifications

`notifyOnRequest` runs when a trusted-contact request is created. It checks that the request is still pending, then sends a generic web push to the installation saved by the linked contact. The alert uses a five-minute lifetime and a stable notification tag. The request details stay in the signed-in dashboard.

Set `BIFOCAL_DASHBOARD_URL` to the dashboard's HTTPS URL when deploying the function. The runtime service account needs Firestore document access and `cloudmessaging.messages.create`. The emulator deliberately skips the real FCM call. The function tests cover recipient selection, safe payloads, and stale registration cleanup.

When the project is on Blaze and the dashboard has an HTTPS URL, run this from the repository root to deploy just the rules and the notification trigger.

```sh
npx firebase-tools@15.37.0 deploy --project hackathon --only "firestore:rules,functions:notifyOnRequest"
```
