import type { RequestChannel, ScreeningResult } from "@bifocal/core";

export interface MessageSnapshot {
  sourceId?: string;
  text: string;
  senderEmail?: string;
  channel: RequestChannel;
}

export interface Card extends MessageSnapshot {
  id: string;
  result: ScreeningResult;
  privateCheckFinished: boolean;
  fromFlaggedLink?: boolean;
  request?: { uid: string; id: string };
}

export const cardKey = (tabId: number) => `card:${tabId}`;
export const contactKey = (tabId: number) => `contact:${tabId}`;

export type CheckNotice = { id: string; flagged: boolean; fromFlaggedLink: boolean };

export type ExtensionMessage =
  | { type: "snapshot"; snapshot: MessageSnapshot | null }
  | { type: "show-card"; contact?: boolean }
  | { type: "check-notice"; notice: CheckNotice | null }
  | { type: "flagged-link"; href: string }
  | { type: "check-page" }
  | { type: "page-checks-disabled" }
  | { type: "pause-choice"; choice: "back" | "contact" | "continue" }
  | { type: "private-result"; tabId: number; cardId: string; result: ScreeningResult }
  | { type: "request-sent"; tabId: number; cardId: string; requestId: string; uid: string };
