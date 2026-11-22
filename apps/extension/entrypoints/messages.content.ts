import { defineContentScript } from "wxt/utils/define-content-script";
import { observeIncomingMessages } from "../adapters/google-messages";
import { showChecks } from "../lib/show-checks";

export default defineContentScript({
  matches: ["https://messages.google.com/web/*"],
  main(ctx) {
    const check = showChecks(ctx);
    ctx.onInvalidated(observeIncomingMessages(document, (message) => check(message ? {
      channel: "sms",
      sourceId: `${message.conversationId}/${message.messageId}`,
      text: message.sender ? `From: ${message.sender}\n${message.text}` : message.text,
    } : null)));
  },
});
