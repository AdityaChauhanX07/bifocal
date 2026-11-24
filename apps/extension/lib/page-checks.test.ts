import assert from "node:assert/strict";
import { test } from "node:test";
import { skipsWebsiteCheck } from "./page-checks.ts";

test("website checks skip the trusted-contact dashboard but still cover the practice checkout", () => {
  for (const domain of ["web.app", "firebaseapp.com"]) {
    const origin = `https://bifocal-buildhybridai2026.${domain}`;
    assert.equal(skipsWebsiteCheck(new URL(`${origin}/dashboard?request=example`)), true);
    assert.equal(skipsWebsiteCheck(new URL(`${origin}/demo/checkout.html`)), false);
  }
  assert.equal(skipsWebsiteCheck(new URL("https://example.test/dashboard")), false);
});
