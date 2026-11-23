# Firestore contract

The protected user's Firebase UID doubles as the circle ID. Create `circles/{protectedUid}` with `protectedUid`, a trimmed and lowercase `contactEmail`, `contactUid: null`, and `createdAt: serverTimestamp()`. The owner can correct the email while the invite is pending. The linked contact stays attached to that circle's history.

After Google sign-in, find pending invites with both `where("contactEmail", "==", user.email.toLowerCase())` and `where("contactUid", "==", null)`. Set `contactUid` to the signed-in user's UID. The rules check the verified email in their Firebase Auth token. The contact can also save the name from that token to the circle as `contactName` for redaction. Query `where("contactUid", "==", user.uid)` to find circles the contact already joined.

Each user can read and write their own `users/{uid}` profile. The required fields are `displayName`, `role` (`protected` or `contact`), and `createdAt: serverTimestamp()`. Set `circleId` after joining or in the same write batch. The optional `fcmInstallationId` targets web push on the latest device enabled for that user. The installation ID and legacy `fcmToken` stay private to the user and the backend. Access to requests comes from circle membership.

Under `circles/{circleId}/requests/{requestId}`, the owner creates a request after the contact joins. Include `tier`, `tactics`, `summary`, `channel` (`email`, `sms`, or `web`), `createdAt: serverTimestamp()`, and `status: "pending"`. Preview the locally redacted summary before sending it. The rules cap the summary at 280 characters and reject common link formats.

The linked contact replies with `status: "replied"`, `repliedAt: serverTimestamp()`, and a `replyPreset` (`call_me`, `looks_fine`, or `call_bank`) or a short `replyNote`. A reply can include both. Each request accepts one reply.

## Local verification

Use Node.js 24.12+ and Java 21+ on your PATH. Run these commands from the repository root. The demo project lives in the local emulator.

```sh
npm --prefix firebase ci
npx firebase-tools@15.37.0 emulators:exec --only firestore --project demo-bifocal "npm --prefix firebase test"
```
