import type { Tactic, Tier } from "./screening.ts";

export const riskLabels: Record<Tier, string> = {
  none: "No obvious warning signs",
  suspicious: "Suspicious",
  high: "High risk",
};

export const requestChannels = {
  email: "Email",
  sms: "Text message",
  web: "Web page",
} as const;

export const replyPresets = {
  call_me: "Don’t respond. I’ll call you.",
  looks_fine: "This one looks fine.",
  call_bank: "Call the bank directly.",
} as const;

export type RequestChannel = keyof typeof requestChannels;
export type ReplyPreset = keyof typeof replyPresets;

export interface ContactRequest {
  tier: Tier;
  tactics: Tactic[];
  summary: string;
  channel: RequestChannel;
}

export interface ContactReply {
  replyPreset?: ReplyPreset;
  replyNote?: string;
}
