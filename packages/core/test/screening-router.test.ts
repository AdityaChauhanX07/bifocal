import assert from "node:assert/strict";
import test from "node:test";
import {
  deviceModelReady, prepareCloudPreview, screenApprovedPreview, screenPrivateText, screenSample, trySamples,
} from "../src/index.ts";
import type { ScreenMode, ScreenModel, TrySampleId } from "../src/index.ts";

const unavailable: ScreenModel = async () => { throw new Error("Model unavailable"); };

test("uses hybrid mode only with a built-in sample selected by ID", async () => {
  const calls: [ScreenMode, string][] = [];
  const model: ScreenModel = async (mode, text) => {
    calls.push([mode, text]);
    return {
      source: "cloud",
      json: JSON.stringify({
        tier: "none", tactics: [], evidence_quote: "", next_step: "no_action", confidence: "high",
      }),
    };
  };

  assert.equal(trySamples.length, 8);
  assert.equal((await screenSample("refund-receipt", model)).source, "cloud");
  assert.throws(() => screenSample("text entered by a user" as TrySampleId, model), /Unknown sample/);
  assert.deepEqual(calls, [["sample", trySamples.find((sample) => sample.id === "refund-receipt")?.text]]);
});

test("checks pasted text on-device and falls back locally if the model fails", async () => {
  const message = "Buy a gift card and send me the code.";
  const modes: ScreenMode[] = [];
  const result = await screenPrivateText(message, async (mode, text) => {
    modes.push(mode);
    assert.equal(text, message);
    throw new Error("No local model");
  });

  assert.deepEqual(modes, ["on-device"]);
  assert.equal(result.source, "basic");
  assert.equal(result.screening.tier, "high");
  assert.ok(message.includes(result.screening.evidence_quote));

  const unexpected = await screenPrivateText(message, async () => ({
    source: "cloud",
    json: JSON.stringify(result.screening),
  }));
  assert.equal(unexpected.source, "basic");
});

test("accepts only a valid model response, including an exact quote from the checked text", async () => {
  const message = "Buy a gift card.";
  const screening = {
    tier: "high", tactics: ["gift_card_payment"], evidence_quote: "Buy a gift card",
    next_step: "do_not_pay", confidence: "high",
  };
  const checked = await screenPrivateText(message, async () => ({
    source: "on-device", json: JSON.stringify(screening),
  }));
  assert.equal(checked.source, "on-device");
  const inaccurate = await screenPrivateText(message, async () => ({
    source: "on-device", json: JSON.stringify({ ...screening, evidence_quote: "Send a gift card" }),
  }));
  assert.equal(inaccurate.source, "basic");
});

test("sends the exact redacted preview only through the explicit cloud action", async () => {
  const original = "Reply with your one-time code. Verification code: 123456. Email alex@example.test.";
  let calls = 0;
  const preview = prepareCloudPreview(original);
  assert.equal(calls, 0);
  assert.doesNotMatch(preview, /123456|alex@example/);

  const result = await screenApprovedPreview(preview, async (mode, text) => {
    calls++;
    assert.equal(mode, "cloud");
    assert.equal(text, preview);
    return {
      source: "cloud",
      json: JSON.stringify({
        tier: "high", tactics: ["credential_request"], evidence_quote: "Reply with your one-time code",
        next_step: "call_known_number", confidence: "high",
      }),
    };
  });
  assert.equal(calls, 1);
  assert.equal(result.source, "cloud");
});

test("the basic fallback distinguishes action requests from ordinary notices", async () => {
  for (const id of ["new-number", "remote-support", "security-code", "wire-payment"] as const) {
    const result = await screenSample(id, unavailable);
    assert.equal(result.screening.tier, "high", id);
  }
  assert.equal((await screenSample("locked-account", unavailable)).screening.tier, "suspicious");
  for (const id of ["fraud-alert", "pickup-code", "refund-receipt"] as const) {
    const result = await screenSample(id, unavailable);
    assert.equal(result.screening.tier, "none", id);
  }
});

test("uses the local model only when Chrome reports it is ready", async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "LanguageModel");
  function availability(status: string | undefined) {
    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: status ? { availability: async () => status } : undefined,
    });
  }

  try {
    availability(undefined);
    assert.equal(await deviceModelReady(), false);
    availability("downloadable");
    assert.equal(await deviceModelReady(), false);
    availability("available");
    assert.equal(await deviceModelReady(), true);
  } finally {
    if (saved) Object.defineProperty(globalThis, "LanguageModel", saved);
    else Reflect.deleteProperty(globalThis, "LanguageModel");
  }
});
