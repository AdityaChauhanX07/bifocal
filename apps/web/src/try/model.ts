import type { ScreenModel } from "@bifocal/core";
import { cloudScreeningEnabled, runModel } from "../screening-model";

export const sampleCloudEnabled = cloudScreeningEnabled;
export const pastedCloudEnabled = cloudScreeningEnabled
  && import.meta.env.VITE_BIFOCAL_ENABLE_PASTED_CLOUD === "true";

export const runScreening: ScreenModel = async (mode, text) => {
  if (mode === "cloud" && !pastedCloudEnabled) throw new Error("Cloud screening unavailable.");
  return runModel(mode, text);
};
