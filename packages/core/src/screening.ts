const tiers = ["none", "suspicious", "high"] as const;
const confidenceLevels = ["low", "medium", "high"] as const;
export const quoteLimit = 140;

export const tacticDescriptions = {
  urgency: "Pressure to act before there is time to check.",
  threat_or_fear: "Threats of losing money, access, or freedom to force a decision.",
  gift_card_payment: "Requests to pay with gift cards or share their codes.",
  crypto_or_wire_payment: "Requests to pay a fee, bill, or stranger by crypto or wire.",
  remote_access: "Requests to install software or let someone control the device.",
  credential_request: "Requests for passwords, PINs, or one-time codes.",
  impersonates_bank: "Poses as a bank or its fraud team.",
  impersonates_government: "Poses as a government agency or official.",
  impersonates_tech_support: "Poses as technical support.",
  impersonates_family: "Poses as a relative or someone the recipient knows.",
  prize_or_refund: "Promises a prize or refund to induce payment or disclosure.",
  romance: "Uses a romantic relationship to ask for money or personal information.",
  mismatched_link: "The visible destination conflicts with the claimed organization.",
  asks_for_secrecy: "Tells the recipient to keep the request from people they trust.",
} as const;

export const nextSteps = {
  call_known_number: "Call using a number you already trust, such as the one on your card.",
  do_not_pay: "Do not send money or share payment details.",
  do_not_install: "Close the page without installing anything.",
  delete_and_ignore: "Delete the message without replying.",
  ask_family: "Ask someone you trust before you act.",
  no_action: "No action needed based on this check.",
} as const;

export type Tier = (typeof tiers)[number];
export type Tactic = keyof typeof tacticDescriptions;
export type NextStep = keyof typeof nextSteps;

export interface Screening {
  tier: Tier;
  tactics: Tactic[];
  evidence_quote: string;
  next_step: NextStep;
  confidence: (typeof confidenceLevels)[number];
}

const properties = {
  tier: { type: "string" as const, enum: [...tiers] },
  tactics: {
    type: "array" as const,
    items: { type: "string" as const, enum: Object.keys(tacticDescriptions) },
  },
  evidence_quote: { type: "string" as const },
  next_step: { type: "string" as const, enum: Object.keys(nextSteps) },
  confidence: { type: "string" as const, enum: [...confidenceLevels] },
};

export const screenSchema = {
  type: "object" as const,
  properties,
  required: Object.keys(properties),
};

function isOneOf<Label extends string>(options: readonly Label[], value: unknown): value is Label {
  return options.some((option) => option === value);
}

function hasKey<Options extends object>(options: Options, value: unknown): value is keyof Options {
  return typeof value === "string" && Object.hasOwn(options, value);
}

function isTactic(value: unknown): value is Tactic {
  return hasKey(tacticDescriptions, value);
}

export type ScreeningIssue = "invalid_json" | "invalid_fields" | "unexpected_warning_details"
  | "missing_tactics" | "missing_quote" | "quote_too_long" | "quote_not_in_message" | "no_action_for_warning";

type ScreenValidation = { screening: Screening; issue: null } | { screening: null; issue: ScreeningIssue };

export function validateScreening(json: string, message: string): ScreenValidation {
  let screening: unknown;
  try {
    screening = JSON.parse(json);
  } catch {
    return { screening: null, issue: "invalid_json" };
  }

  if (!screening || typeof screening !== "object") return { screening: null, issue: "invalid_fields" };
  const { tier, tactics, evidence_quote, next_step, confidence } =
    screening as Record<string, unknown>;

  if (
    !isOneOf(tiers, tier) ||
    !Array.isArray(tactics) ||
    !tactics.every(isTactic) ||
    typeof evidence_quote !== "string" ||
    !hasKey(nextSteps, next_step) ||
    !isOneOf(confidenceLevels, confidence)
  ) {
    return { screening: null, issue: "invalid_fields" };
  }

  if (tier === "none") {
    if (tactics.length || evidence_quote !== "" || next_step !== "no_action") {
      return { screening: null, issue: "unexpected_warning_details" };
    }
  } else {
    // The response schema cannot tell whether the quote came from the message.
    if (!tactics.length) return { screening: null, issue: "missing_tactics" };
    if (!evidence_quote.trim()) return { screening: null, issue: "missing_quote" };
    if ([...evidence_quote].length > quoteLimit) return { screening: null, issue: "quote_too_long" };
    if (!message.includes(evidence_quote)) return { screening: null, issue: "quote_not_in_message" };
    if (next_step === "no_action") return { screening: null, issue: "no_action_for_warning" };
  }

  return { screening: { tier, tactics, evidence_quote, next_step, confidence }, issue: null };
}

export function parseScreening(json: string, message: string): Screening | null {
  return validateScreening(json, message).screening;
}
