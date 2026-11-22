# Ask my trusted contact

Mount `TrustedContact` under the WXT side panel’s risk card. Pass the Firebase Auth user and Firestore instance from the extension. The same component can appear in the Pause flow.

```tsx
<TrustedContact
  cardId={cardId}
  user={currentUser}
  db={firestore}
  ai={nanoReady ? ai : undefined}
  message={messageText}
  screening={screening}
  channel={channel}
  onSignIn={signIn}
  sentRequestId={sentRequestId}
  onRequestSent={rememberRequestId}
/>
```

Use a new card ID when the underlying message or result changes. The ID stays local. To restore a reply after reopening the panel, store the returned Firestore request ID with the corresponding card and load it before mounting. Sign-in and Firebase initialization come from the extension host.

The user adds the contact’s Google email. The invitation is available on the dashboard when the contact signs in with that account. Once the invitation is accepted, the owner reviews the summary and warning signs and explicitly chooses **Send request**. Replies appear on the same card.

If Gemini Nano is ready, Firebase AI Logic uses `ONLY_ON_DEVICE` to select the lead warning from codes already returned by screening. The summary uses app-written sentences for those codes. The fallback uses the same sentences in screening order. The message, evidence quote, sender and page are excluded from the request. Firestore writes require a connection, and retries reuse the same request ID.

## Local verification

Use Node 24.12+ and Java 21+ on your PATH. From the repository root, run `npm ci`, then `npm test` and `npm run typecheck`. For the owner-to-dashboard flow, run the Auth and Firestore emulators with the test below.

```sh
npx firebase-tools@15.37.0 emulators:exec --only auth,firestore --project demo-bifocal "npm run test:trusted-contact"
```
