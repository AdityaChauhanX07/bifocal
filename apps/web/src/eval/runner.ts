import { redactText, validateScreening } from "@bifocal/core";
import type { ScreenMode, Screening, ScreeningIssue, Tactic, Tier } from "@bifocal/core";

export const evalPaths = [
  { id: "on-device", label: "On-device", detail: "Gemini Nano with the original synthetic text." },
  { id: "cloud-raw", label: "Cloud · original text", detail: "Google Gemini with the original synthetic text." },
  { id: "cloud-redacted", label: "Cloud · redacted text", detail: "Google Gemini after Bifocal’s redaction step." },
] as const;

export type EvalPath = (typeof evalPaths)[number]["id"];
type Source = "on-device" | "cloud";
export type EvalModel = (mode: ScreenMode, text: string, signal?: AbortSignal) => Promise<{ json: string; source: Source }>;

interface DatasetRow {
  id: string;
  split: "prompt" | "held_out";
  channel: "email" | "sms" | "web";
  text: string;
  tier: Tier;
  tactics: Tactic[];
  hard_lookalike: boolean;
}

export interface EvalRow {
  path: EvalPath;
  row: DatasetRow;
  source: Source | null;
  screening: Screening | null;
  status: "valid" | "invalid_response" | "wrong_source" | "request_error";
  validationIssue: ScreeningIssue | null;
  latencyMs: number;
}

export function parseHeldOut(jsonl: string) {
  return jsonl.trim().split(/\r?\n/)
    .map((line) => JSON.parse(line) as DatasetRow)
    .filter((row) => row.split === "held_out");
}

export async function runEvaluation(
  path: EvalPath,
  dataset: readonly DatasetRow[],
  run: EvalModel,
  { signal, onRow, beforeRow }: {
    signal: AbortSignal;
    onRow: (row: EvalRow) => void;
    beforeRow?: (signal: AbortSignal) => Promise<void>;
  },
) {
  const mode = path === "on-device" ? "on-device" : "cloud";
  for (const row of dataset) {
    signal.throwIfAborted();
    if (beforeRow) await beforeRow(signal);
    signal.throwIfAborted();

    const started = performance.now();
    let source: Source | null = null;
    let screening: Screening | null = null;
    let validationIssue: ScreeningIssue | null = null;
    let status: EvalRow["status"] = "request_error";
    try {
      const text = path === "cloud-redacted" ? redactText(row.text) : row.text;
      const reply = await run(mode, text, signal);
      source = reply.source;
      if (source === mode) {
        const check = validateScreening(reply.json, text);
        screening = check.screening;
        validationIssue = check.issue;
        status = check.issue ? "invalid_response" : "valid";
      } else {
        status = "wrong_source";
      }
    } catch {
      signal.throwIfAborted();
    }
    signal.throwIfAborted();
    onRow({ path, row, source, screening, status, validationIssue, latencyMs: performance.now() - started });
  }
}

export function summarize(rows: readonly EvalRow[]) {
  const valid = rows.flatMap((entry) => entry.screening ? [{ ...entry, screening: entry.screening }] : []);
  const scams = valid.filter(({ row }) => row.tier !== "none");
  const legitimate = valid.filter(({ row }) => row.tier === "none");
  const lookalikes = legitimate.filter(({ row }) => row.hard_lookalike);
  const alarms = lookalikes.filter(({ screening }) => screening.tier !== "none");
  const times = valid.map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
  const halfway = Math.floor(times.length / 2);
  const medianLatency = !times.length ? null
    : (times[halfway] + times[Math.floor((times.length - 1) / 2)]) / 2;

  return {
    valid: valid.length,
    returned: rows.filter(({ status }) => status === "valid" || status === "invalid_response").length,
    scams: scams.length,
    caught: scams.filter(({ screening }) => screening.tier !== "none").length,
    legitimate: legitimate.length,
    falseHigh: legitimate.filter(({ screening }) => screening.tier === "high").length,
    lookalikes: lookalikes.length,
    alarms,
    tierAgreement: valid.filter(({ row, screening }) => row.tier === screening.tier).length,
    medianLatency,
  };
}

export function toCsv(rows: readonly EvalRow[]) {
  const columns = [
    "path", "id", "channel", "hard_lookalike", "expected_tier", "expected_tactics",
    "predicted_tier", "predicted_tactics", "source", "status", "latency_ms", "validation_issue",
  ];
  const body = rows.map(({ path, row, screening, source, status, latencyMs, validationIssue }) => [
    path, row.id, row.channel, row.hard_lookalike, row.tier, row.tactics.join("|"),
    screening?.tier ?? "", screening?.tactics.join("|") ?? "", source ?? "", status, latencyMs.toFixed(1), validationIssue ?? "",
  ].join(","));
  return [columns.join(","), ...body].join("\r\n") + "\r\n";
}

export function paceCloudRequests(intervalMs = 6_100) {
  let nextSlot = 0;
  return async (signal: AbortSignal) => {
    signal.throwIfAborted();
    const wait = nextSlot - performance.now();
    if (wait > 0) {
      await new Promise<void>((resolve, reject) => {
        function canceled() {
          clearTimeout(timer);
          reject(signal.reason);
        }
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", canceled);
          resolve();
        }, wait);
        signal.addEventListener("abort", canceled, { once: true });
      });
    }
    signal.throwIfAborted();
    nextSlot = performance.now() + intervalMs;
  };
}
