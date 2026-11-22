import { quoteLimit } from "./screening.ts";
import type { NextStep, Screening, Tactic, Tier } from "./screening.ts";

const warnings: readonly {
  pattern: RegExp;
  tactic: Tactic;
  tier: Exclude<Tier, "none">;
  nextStep: NextStep;
}[] = [
  { pattern: /\b(?:buy|pay|send|text)\b[^.!?\n]{0,80}\bgift cards?\b/i, tactic: "gift_card_payment", tier: "high", nextStep: "do_not_pay" },
  { pattern: /\b(?:wire (?:the |your )?(?:money|payment|funds)|(?:pay|send)\b[^.!?\n]{0,60}\b(?:bitcoin|crypto))\b/i, tactic: "crypto_or_wire_payment", tier: "high", nextStep: "do_not_pay" },
  { pattern: /\b(?:install|download|run|open)\b[^.!?\n]{0,85}\b(?:remote (?:support|access)|anydesk|teamviewer)\b/i, tactic: "remote_access", tier: "high", nextStep: "do_not_install" },
  { pattern: /\b(?:send|share|text|reply|read)\b[^.!?\n]{0,80}\b(?:one[- ]time code|verification code|security code|password|PIN)\b/i, tactic: "credential_request", tier: "high", nextStep: "call_known_number" },
  { pattern: /\b(?:account|access)\b[^.!?\n]{0,70}\b(?:locked|suspended|closed)\b/i, tactic: "threat_or_fear", tier: "suspicious", nextStep: "call_known_number" },
  { pattern: /\b(?:verify|confirm|pay|click|update)\b[^.!?\n]{0,55}\b(?:immediately|right now|within \d+ hours)\b/i, tactic: "urgency", tier: "suspicious", nextStep: "ask_family" },
];

export function screenBasic(message: string): Screening {
  const tactics: Tactic[] = [];
  let lead: typeof warnings[number] | undefined;
  let quote = "";

  for (const warning of warnings) {
    const match = message.match(warning.pattern);
    if (!match) continue;
    tactics.push(warning.tactic);
    if (!lead) {
      lead = warning;
      quote = [...match[0]].slice(0, quoteLimit).join("");
    }
  }

  if (/\b(?:don['’]t tell|keep this between us|keep this secret)\b/i.test(message) && lead) {
    tactics.push("asks_for_secrecy");
  }

  return {
    tier: lead?.tier ?? "none",
    tactics,
    evidence_quote: quote,
    next_step: lead?.nextStep ?? "no_action",
    confidence: "low",
  };
}
