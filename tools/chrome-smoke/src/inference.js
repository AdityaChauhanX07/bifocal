import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from "firebase/ai";
import { initializeApp } from "firebase/app";
import { parseScreening, screenSchema, systemPrompt } from "../../../packages/core/src/index.ts";
import firebaseConfig from "../firebase.local.json";

const message = "Buy a gift card now and send me the code. Don't tell anyone.";

export async function runCheck() {
  if (!globalThis.LanguageModel) {
    throw new Error("The Chrome Prompt API is unavailable in this extension document.");
  }

  const availability = await globalThis.LanguageModel.availability();
  if (availability !== "available") {
    throw new Error(`Gemini Nano status: ${availability}. Check that it is installed in this profile.`);
  }

  const app = initializeApp(firebaseConfig);
  const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        initialPrompts: [{ role: "system", content: [{ type: "text", value: systemPrompt }] }],
      },
      promptOptions: { responseConstraint: screenSchema },
    },
  });

  const start = performance.now();
  const { response } = await model.generateContent(message);
  if (response.inferenceSource !== InferenceSource.ON_DEVICE) {
    throw new Error(`Unexpected inference source: ${response.inferenceSource}`);
  }

  const screening = parseScreening(response.text(), message);
  if (!screening) {
    throw new Error("The model response did not pass the shared screening parser.");
  }

  return {
    inferenceSource: response.inferenceSource,
    online: navigator.onLine,
    elapsedMs: Math.round(performance.now() - start),
    screening,
  };
}
