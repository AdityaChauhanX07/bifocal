import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { redactText } from "@bifocal/core";
import { evalPaths, parseHeldOut, runEvaluation, summarize, toCsv } from "../src/eval/runner.ts";

const dataset = parseHeldOut(readFileSync(new URL("../../../eval/dataset.jsonl", import.meta.url), "utf8"));
const neutral = JSON.stringify({
  tier: "none", tactics: [], evidence_quote: "", next_step: "no_action", confidence: "high",
});
const high = JSON.stringify({
  tier: "high", tactics: ["urgency"], evidence_quote: "test", next_step: "ask_family", confidence: "medium",
});

test("selects only the 65 held-out rows, including 20 hard look-alikes", () => {
  assert.equal(dataset.length, 65);
  assert.equal(new Set(dataset.map((row) => row.id)).size, 65);
  assert.equal(dataset.filter((row) => row.tier !== "none").length, 32);
  assert.equal(dataset.filter((row) => row.hard_lookalike).length, 20);
});

test("runs all three paths against the exact dataset and only redacts the redacted path", async () => {
  const rows = [];
  for (const { id } of evalPaths) {
    let index = 0;
    await runEvaluation(id, dataset, async (mode, text) => {
      assert.equal(mode, id === "on-device" ? "on-device" : "cloud");
      const original = dataset[index++].text;
      assert.equal(text, id === "cloud-redacted" ? redactText(original) : original);
      return { source: mode, json: neutral };
    }, { signal: new AbortController().signal, onRow: (row) => rows.push(row) });
  }

  assert.equal(rows.length, 195);
  for (const { id } of evalPaths) {
    const path = rows.filter((row) => row.path === id);
    const scores = summarize(path);
    assert.equal(scores.valid, 65);
    assert.equal(scores.caught, 0);
    assert.equal(scores.tierAgreement, 33);
  }
  const csv = toCsv(rows);
  assert.equal(csv.trimEnd().split("\r\n").length, 196);
  assert.match(csv, /^path,id,channel,hard_lookalike,expected_tier/);
  assert.ok(!csv.includes(dataset[0].text));
});

test("keeps request failures and wrong-source replies out of the accuracy denominators", async () => {
  const first = { id: "fake-scam", channel: "sms", text: "test scam", tier: "high", tactics: ["urgency"] };
  const second = { id: "fake-lookalike", channel: "email", text: "test notice", tier: "none", tactics: [], hard_lookalike: true };
  const fixtures = [first, second, first, second, first, second];
  const outcomes = [
    { source: "on-device", json: high },
    { source: "on-device", json: high },
    { source: "cloud", json: neutral },
    { source: "on-device", json: "invalid-raw-response" },
    { source: "on-device", json: high.replace('"test"', '"invented quote"') },
  ];
  let index = 0;
  const rows = [];
  await runEvaluation("on-device", fixtures, async () => {
    const reply = outcomes[index++];
    if (!reply) throw new Error("Request failed");
    return reply;
  }, { signal: new AbortController().signal, onRow: (row) => rows.push(row) });

  assert.deepEqual(rows.map((row) => row.status), [
    "valid", "valid", "wrong_source", "invalid_response", "invalid_response", "request_error",
  ]);
  assert.deepEqual(rows.map((row) => row.validationIssue), [
    null, null, null, "invalid_json", "quote_not_in_message", null,
  ]);
  const summary = summarize(rows);
  assert.equal(summary.scams, 1);
  assert.equal(summary.caught, 1);
  assert.equal(summary.falseHigh, 1);
  assert.equal(summary.alarms[0].row.id, "fake-lookalike");
  assert.equal(summary.tierAgreement, 1);
  assert.equal(summary.valid, 2);
  assert.equal(summary.returned, 4);
  assert.ok(summary.medianLatency >= 0);

  const csv = toCsv(rows);
  assert.match(csv, /status,latency_ms,validation_issue\r\n/);
  assert.match(csv, /invalid_response,\d+\.\d,invalid_json\r\n/);
  assert.match(csv, /invalid_response,\d+\.\d,quote_not_in_message\r\n/);
  assert.doesNotMatch(csv, /invalid-raw-response|invented quote|test scam|test notice/);
});

test("stops before another model call when the run is canceled", async () => {
  const task = new AbortController();
  const rows = [];
  let calls = 0;
  await assert.rejects(runEvaluation("on-device", dataset, async () => {
    calls++;
    return { source: "on-device", json: neutral };
  }, { signal: task.signal, onRow: (row) => {
    rows.push(row);
    task.abort();
  } }), { name: "AbortError" });
  assert.equal(rows.length, 1);
  assert.equal(calls, 1);
});
