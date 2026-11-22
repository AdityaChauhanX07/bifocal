import { deviceModelReady, screenSchema } from "@bifocal/core";
import type { ScreenModel } from "@bifocal/core";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from "firebase/ai";
import { initializeApp } from "firebase/app";
import { modelSettings } from "./settings";

// This app belongs to the offline host and has no cloud credentials.
export const privateAI = getAI(initializeApp({
  apiKey: "demo-bifocal",
  projectId: "demo-bifocal",
  appId: "demo-bifocal-extension",
}, "bifocal-private"), { backend: new GoogleAIBackend() });

export function privateModel(signal: AbortSignal): ScreenModel {
  return async (mode, text) => {
    if (mode !== "on-device" || !await deviceModelReady()) throw new Error("Private check unavailable");
    const privateScreen = getGenerativeModel(privateAI, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          initialPrompts: [{ role: "system", content: [{ type: "text", value: modelSettings.system_prompt }] }],
        },
        promptOptions: { responseConstraint: screenSchema },
      },
    });
    const { response } = await privateScreen.generateContent(text.slice(0, Number(modelSettings.max_chars_on_device)), {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    if (response.inferenceSource !== InferenceSource.ON_DEVICE) throw new Error("Unexpected inference source");
    return { json: response.text(), source: "on-device" };
  };
}
