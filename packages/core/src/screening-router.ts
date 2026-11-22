import { screenBasic } from "./basic-screening.ts";
import { redactText } from "./redaction.ts";
import type { RedactionOptions } from "./redaction.ts";
import { parseScreening } from "./screening.ts";
import type { Screening } from "./screening.ts";
import { trySamples } from "./try-samples.ts";
import type { TrySampleId } from "./try-samples.ts";

export type ScreenMode = "sample" | "on-device" | "cloud";
type Source = "on-device" | "cloud";
export type ScreenModel = (mode: ScreenMode, text: string) => Promise<{ json: string; source: Source }>;

export interface ScreeningResult {
  screening: Screening;
  source: Source | "basic";
}

declare const reviewedText: unique symbol;
export type CloudPreview = string & { readonly [reviewedText]: true };
export const messageLimit = 6_000;

async function withModel(mode: ScreenMode, text: string, run: ScreenModel): Promise<ScreeningResult> {
  const { json, source } = await run(mode, text);
  if (mode !== "sample" && source !== mode) throw new Error("Unexpected screening source.");
  const screening = parseScreening(json, text);
  if (!screening) throw new Error("Invalid screening response.");
  return { screening, source };
}

async function checkLocallyOrFallback(mode: "sample" | "on-device", text: string, run: ScreenModel) {
  try {
    return await withModel(mode, text, run);
  } catch {
    return { screening: screenBasic(text), source: "basic" as const };
  }
}

export function screenSample(id: TrySampleId, run: ScreenModel) {
  const sample = trySamples.find((example) => example.id === id);
  if (!sample) throw new Error("Unknown sample.");
  return checkLocallyOrFallback("sample", sample.text, run);
}

export function screenPrivateText(text: string, run: ScreenModel) {
  return checkLocallyOrFallback("on-device", text, run);
}

export function prepareCloudPreview(text: string, options?: RedactionOptions): CloudPreview {
  return redactText(text, options) as CloudPreview;
}

export function screenApprovedPreview(preview: CloudPreview, run: ScreenModel) {
  return withModel("cloud", preview, run);
}
