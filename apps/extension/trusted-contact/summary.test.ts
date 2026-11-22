import assert from "node:assert/strict";
import test from "node:test";
import { tacticDescriptions } from "@bifocal/core";
import type { Tactic } from "@bifocal/core";
import { draftRequest, prepareRequest } from "./summary.ts";

test("builds a preview from warning labels without using message text", async () => {
  const draft = await prepareRequest(
    { tier: "high", tactics: ["urgency", "gift_card_payment", "urgency"] },
    "sms",
    "Jules, send the gift card code 198394 to https://pay.example.test.",
  );
  assert.deepEqual(draft, {
    tier: "high",
    tactics: ["urgency", "gift_card_payment"],
    summary: [tacticDescriptions.urgency, tacticDescriptions.gift_card_payment].join(" "),
    channel: "sms",
  });
});

test("only uses a model preference when the screening detected that warning", () => {
  const screening = { tier: "high", tactics: ["urgency", "gift_card_payment"] } as const;
  const warning = { tier: screening.tier, tactics: [...screening.tactics] };
  assert.equal(draftRequest(warning, "email", "gift_card_payment").tactics[0], "gift_card_payment");
  for (const choice of ["remote_access", "Visit https://pay.example.test", { lead: "urgency" }]) {
    assert.deepEqual(draftRequest(warning, "email", choice), draftRequest(warning, "email"));
  }
});

test("keeps all warnings available for the preview and the summary under 280 characters", () => {
  const tactics = Object.keys(tacticDescriptions) as Tactic[];
  for (const lead of tactics) {
    const draft = draftRequest({ tier: "high", tactics }, "web", lead);
    assert.equal(draft.tactics.length, tactics.length);
    assert.ok(draft.summary.length <= 280);
    assert.doesNotMatch(draft.summary, /https?:|www\./i);
  }
  assert.ok(draftRequest({ tier: "none", tactics: [] }, "web").summary);
});
