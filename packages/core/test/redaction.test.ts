import assert from "node:assert/strict";
import { test } from "node:test";
import { redactText } from "../src/index.ts";

test("masks known names with case-insensitive word boundaries", () => {
  const text = "NORA VALE, ask Daniel Example first. Nora can call. Norah and Danielson will wait.";
  assert.equal(
    redactText(text, {
      profile: { name: "Nora Vale" },
      trustedContact: { name: "Daniel Example" },
    }),
    "[MY_NAME], ask [CONTACT_NAME] first. [MY_NAME] can call. Norah and Danielson will wait.",
  );
});

test("masks known and unknown emails while preserving only the sender domain", () => {
  const text = "From: alerts@bank.example; to: NORA@mail.example, help@contact.example, other@test.example.";
  assert.equal(
    redactText(text, {
      senderEmail: "alerts@bank.example",
      profile: { email: "nora@mail.example" },
      trustedContact: { email: "help@contact.example" },
    }),
    "From: [SENDER]@bank.example; to: [MY_EMAIL], [CONTACT_EMAIL], [EMAIL].",
  );
});

test("redacts a user's email even when they are the sender", () => {
  assert.equal(
    redactText("nora@bank.example", {
      senderEmail: "NORA@bank.example",
      profile: { email: "nora@bank.example" },
    }),
    "[MY_EMAIL]",
  );
});

test("redacts the user's phone across formatting changes and keeps a callback number", () => {
  const text = "We have (202) 555-0147 on file. Call our fraud team at +1 202-555-0191.";
  assert.equal(
    redactText(text, { profile: { phone: "+1 202.555.0147" } }),
    "We have [MY_PHONE] on file. Call our fraud team at +1 202-555-0191.",
  );
});

test("redacts the user's phone even when the message asks them to call it", () => {
  assert.equal(
    redactText("Call 2025550147.", { profile: { phone: "(202) 555-0147" } }),
    "Call [MY_PHONE].",
  );
});

test("checks card numbers with Luhn and masks long numeric identifiers", () => {
  assert.equal(
    redactText("Card 4242 4242 4242 4242. Reference 4242424242424243. Account ending in 3591."),
    "Card [CARD]. Reference [ACCOUNT]. Account ending in [ACCOUNT].",
  );
});

test("masks formatted and labelled Social Security numbers", () => {
  assert.equal(
    redactText("Verify 000-00-0000 and SSN: 000000000."),
    "Verify [SSN] and SSN: [SSN].",
  );
});

test("masks verification codes without dropping the reason for the request", () => {
  assert.equal(
    redactText("Your OTP: 123 456. Sign-in code is F3A-7BM. Use 050505 to verify your login."),
    "Your OTP: [CODE]. Sign-in code is [CODE]. Use [CODE] to verify your login.",
  );
});

test("masks a street address including its unit and postal suffix", () => {
  assert.equal(
    redactText("Send it to 742 Example Avenue, Apt 5B, Example City, ZZ 00000. Call me after."),
    "Send it to [ADDRESS]. Call me after.",
  );
});

test("keeps link destinations while removing query strings and fragments", () => {
  assert.equal(
    redactText("Open (https://bank.example/verify?email=mail%40test.example#personal), or verify.example/go?session=private."),
    "Open (https://bank.example/verify), or verify.example/go.",
  );
});

test("removes credentials and identifying data from URL paths", () => {
  assert.equal(
    redactText("https://user:pass@alerts.example/session/nora%40mail.example?session=123", {
      profile: { email: "nora@mail.example" },
    }),
    "https://alerts.example/session/%5BMY_EMAIL%5D",
  );
});

test("retains amounts and scam payment tactics", () => {
  const text = "Pay $5,250.00 in gift cards or wire USD 1000000000. Call 202-555-0191.";
  assert.equal(redactText(text), text);
});

test("masks identifiers copied with Unicode dashes or digit grouping", () => {
  assert.equal(
    redactText("SSN 000\u201300\u20130000. Account: 1,234,567,890. Acct # H7K9-4321-8820."),
    "SSN [SSN]. Account: [ACCOUNT]. Acct # [ACCOUNT].",
  );
});

test("masks a verification code on the line below its label", () => {
  assert.equal(redactText("Verification code:\n123\u2013456"), "Verification code:\n[CODE]");
});

test("masks identifiers inside twice-encoded redirects", () => {
  assert.equal(
    redactText("https://verify.example/jump/nora%2540example.test?x=anything"),
    "https://verify.example/jump/%5BEMAIL%5D",
  );
});

test("masks a known name when it appears in a link hostname", () => {
  assert.equal(
    redactText("Go to https://nora.private.example/verify.", { profile: { name: "Nora Vale" } }),
    "Go to [LINK].",
  );
});
