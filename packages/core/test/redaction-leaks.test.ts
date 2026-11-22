import assert from "node:assert/strict";
import test from "node:test";
import { redactText } from "../src/index.ts";
import type { RedactionOptions } from "../src/index.ts";

const profile = { name: "Rosa Maple", email: "rosa@example.test", phone: "+1 (202) 555-0147" };
const trustedContact = { name: "Fiona Reed", email: "fiona@example.test" };
const options: RedactionOptions = { profile, trustedContact };

const examples = [
  ["protected name", "Rosa Maple, we need you to contact support.", "Rosa Maple"],
  ["protected email", "We received your message from rosa@example.test.", "rosa@example.test"],
  ["contact name", "Send a copy of the receipt to Fiona Reed.", "Fiona Reed"],
  ["contact email", "Forward this to fiona@example.test.", "fiona@example.test"],
  ["other email", "We added billing-team@example.test to your account.", "billing-team@example.test"],
  ["card grouped with spaces", "Charge card 4111 1111 1111 1111 for the test amount.", "4111 1111 1111 1111"],
  ["card grouped with hyphens", "The form printed 5555-5555-5555-4444 on the receipt.", "5555-5555-5555-4444"],
  ["long account", "Our system identified 9876543210987 as the customer account.", "9876543210987"],
  ["labelled account", "Account number: AZ-742P-19. Call the number on the card.", "AZ-742P-19"],
  ["formatted SSN", "The form asks for SSN 123-45-6789.", "123-45-6789"],
  ["unformatted SSN", "Social Security number: 987654321.", "987654321"],
  ["OTP", "Your verification code is 846271. Never share this.", "846271"],
  ["OTP on the next line", "Your sign-in code:\n518032\nUse it to finish signing in.", "518032"],
  ["street and unit", "The package goes to 241 Linden Avenue Apt 7B.", "241 Linden Avenue"],
  ["protected phone with punctuation", "Call (202) 555-0147 to pick up the package.", "(202) 555-0147"],
  ["protected phone without punctuation", "The callback is 2025550147.", "2025550147"],
  ["query-string identifier", "Open https://portal.example.test/help?session=case-redwood-41 for details.", "case-redwood-41"],
  ["fragment identifier", "Visit https://portal.example.test/check#case-willow-78 today.", "case-willow-78"],
  ["encoded name in URL", "Track the shipment at https://portal.example.test/Rosa%20Maple/parcel.", "Rosa%20Maple"],
  ["hyphenated code", "Security code: 74Q-8TZ. Enter it in your usual account.", "74Q-8TZ"],
] as const;

for (const [label, text, planted] of examples) {
  test(`removes a planted ${label}`, () => {
    const redacted = redactText(text, options);
    assert.equal(redacted.toLowerCase().includes(planted.toLowerCase()), false);
  });
}
