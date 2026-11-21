import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScreening } from "../src/index.ts";

const message = "Buy a gift card and send me the code.";
const warning = {
  tier: "high",
  tactics: ["gift_card_payment"],
  evidence_quote: message,
  next_step: "do_not_pay",
  confidence: "high",
};

test("accepts a warning with a quote from the message", () => {
  assert.deepEqual(parseScreening(JSON.stringify(warning), message), warning);
});

test("accepts a result with no warning signs", () => {
  const screening = {
    tier: "none",
    tactics: [],
    evidence_quote: "",
    next_step: "no_action",
    confidence: "medium",
  };

  assert.deepEqual(parseScreening(JSON.stringify(screening), message), screening);
});

test("rejects evidence the model made up or paraphrased", () => {
  const screening = { ...warning, evidence_quote: "Buy a gift card and give me the code." };
  assert.equal(parseScreening(JSON.stringify(screening), message), null);
});

test("rejects overly long quotes even if they match the message", () => {
  const quote = "a".repeat(141);
  const screening = { ...warning, evidence_quote: quote };
  assert.equal(parseScreening(JSON.stringify(screening), quote), null);
});

test("rejects malformed JSON and values outside the screening schema", () => {
  assert.equal(parseScreening("{", message), null);
  assert.equal(parseScreening(JSON.stringify({ ...warning, tactics: ["constructor"] }), message), null);
  assert.equal(parseScreening(JSON.stringify({ ...warning, next_step: "visit_link" }), message), null);
});

test("rejects inconsistent warning details", () => {
  for (const screening of [
    { ...warning, tier: "none" },
    { ...warning, evidence_quote: "" },
    { ...warning, tactics: [] },
    { ...warning, next_step: "no_action" },
  ]) {
    assert.equal(parseScreening(JSON.stringify(screening), message), null);
  }
});
