import { defineContentScript } from "wxt/utils/define-content-script";
import { readOpenEmail } from "../adapters/gmail";
import { showChecks } from "../lib/show-checks";
import { watchPage } from "../lib/watch-page";

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  main(ctx) {
    const check = showChecks(ctx);
    ctx.onInvalidated(watchPage(() => check(readOpenEmail(document))));
  },
});
