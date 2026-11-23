import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScreening, validateScreening } from "../src/index.ts";

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
  const json = JSON.stringify(screening);
  assert.equal(parseScreening(json, message), null);
  assert.deepEqual(validateScreening(json, message), { screening: null, issue: "quote_not_in_message" });
});

test("rejects overly long quotes even if they match the message", () => {
  const quote = "a".repeat(141);
  const screening = { ...warning, evidence_quote: quote };
  assert.equal(parseScreening(JSON.stringify(screening), quote), null);
  assert.equal(validateScreening(JSON.stringify(screening), quote).issue, "quote_too_long");
});

test("rejects malformed JSON and values outside the screening schema", () => {
  assert.equal(parseScreening("{", message), null);
  assert.equal(validateScreening("{", message).issue, "invalid_json");
  assert.equal(parseScreening(JSON.stringify({ ...warning, tactics: ["constructor"] }), message), null);
  assert.equal(parseScreening(JSON.stringify({ ...warning, next_step: "visit_link" }), message), null);
  assert.equal(validateScreening(JSON.stringify({ ...warning, next_step: "visit_link" }), message).issue, "invalid_fields");
});

test("rejects inconsistent warning details", () => {
  for (const [screening, issue] of [
    [{ ...warning, tier: "none" }, "unexpected_warning_details"],
    [{ ...warning, evidence_quote: "" }, "missing_quote"],
    [{ ...warning, tactics: [] }, "missing_tactics"],
    [{ ...warning, next_step: "no_action" }, "no_action_for_warning"],
  ] as const) {
    const json = JSON.stringify(screening);
    assert.equal(parseScreening(json, message), null);
    assert.equal(validateScreening(json, message).issue, issue);
  }
});
