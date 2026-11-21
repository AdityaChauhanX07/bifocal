# Google Messages for web

Call `observeIncomingMessages(document, onMessage)` from the extension's content script for `https://messages.google.com/web/*`. Send each incoming snapshot to the existing on-device screening route and clear the displayed result when the adapter reports `null`. Call the returned cleanup function when the content script stops. For a one-time scan, call `readLatestIncomingMessage(document)`.

The adapter uses the active conversation and the newest rendered incoming text. A message-specific sender takes precedence over the conversation title. The conversation and message IDs let the caller discard an inference result when the user has opened a different thread.

Run `npm test` from the repository root to check the adapter against synthetic DOM fixtures. A paired demo conversation will be needed to verify the live selectors once the content script is wired in.
