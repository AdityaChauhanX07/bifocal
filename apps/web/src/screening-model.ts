import { deviceModelReady, screenSchema, systemPrompt } from "@bifocal/core";
import type { ScreenMode } from "@bifocal/core";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource, Schema } from "firebase/ai";
import type { GenerativeModel } from "firebase/ai";
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { browserSessionPersistence, initializeAuth, signInAnonymously } from "firebase/auth";
import { emulatorBuild, webConfig } from "./firebase-config";

const env = import.meta.env;
const siteKey = env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
export const cloudScreeningEnabled = Boolean(
  !emulatorBuild && (env.PROD || env.VITE_FIREBASE_MODE === "live") && siteKey && Object.values(webConfig).every(Boolean),
);

type ModelRunner = (mode: ScreenMode, text: string, signal?: AbortSignal) => Promise<{
  source: "cloud" | "on-device";
  json: string;
}>;

function setup() {
  const app = initializeApp(cloudScreeningEnabled ? webConfig : {
    apiKey: "demo-bifocal",
    authDomain: "demo-bifocal.firebaseapp.com",
    projectId: "demo-bifocal",
    appId: "demo-bifocal-try",
  }, "bifocal-try");

  if (cloudScreeningEnabled) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = cloudScreeningEnabled ? initializeAuth(app, { persistence: browserSessionPersistence }) : null;
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const props = screenSchema.properties;
  const inCloudParams = {
    model: "gemini-3.5-flash-lite",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: Schema.object({
        properties: {
          tier: Schema.enumString({ enum: props.tier.enum }),
          tactics: Schema.array({ items: Schema.enumString({ enum: props.tactics.items.enum }) }),
          evidence_quote: Schema.string(),
          next_step: Schema.enumString({ enum: props.next_step.enum }),
          confidence: Schema.enumString({ enum: props.confidence.enum }),
        },
      }),
    },
  };
  const onDeviceParams = {
    createOptions: {
      initialPrompts: [{ role: "system" as const, content: [{ type: "text" as const, value: systemPrompt }] }],
    },
    promptOptions: { responseConstraint: screenSchema },
  };
  const models = {
    sample: getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, inCloudParams, onDeviceParams }),
    cloud: getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams }),
  };

  let local: GenerativeModel | undefined;

  async function ensureGuest() {
    if (!auth) throw new Error("Cloud screening is not configured.");
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
  }

  const run: ModelRunner = async (mode, text, signal) => {
    let model: GenerativeModel | undefined;

    if (mode === "cloud") {
      if (!cloudScreeningEnabled || !navigator.onLine) throw new Error("Cloud screening unavailable.");
      await ensureGuest();
      model = models.cloud;
    } else if (mode === "sample" && cloudScreeningEnabled && navigator.onLine) {
      try {
        await ensureGuest();
        model = models.sample;
      } catch {
        // A guest sign-in failure still allows a local check.
      }
    }

    if (!model) {
      // Firebase can lack a Chrome adapter even when ONLY_ON_DEVICE is requested.
      if (!await deviceModelReady()) throw new Error("Local screening unavailable.");
      model = local ??= getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE, onDeviceParams });
    }

    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(12_000);
    const { response } = await model.generateContent(text, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (response.inferenceSource === InferenceSource.ON_DEVICE) {
      return { json: response.text(), source: "on-device" };
    }
    if (response.inferenceSource === InferenceSource.IN_CLOUD) {
      return { json: response.text(), source: "cloud" };
    }
    throw new Error("Unknown screening source.");
  };
  return { run, ensureGuest };
}

let screening: ReturnType<typeof setup> | undefined;

export const runModel: ModelRunner = (mode, text, signal) => {
  screening ??= setup();
  return screening.run(mode, text, signal);
};

export async function prepareCloudScreening() {
  screening ??= setup();
  await screening.ensureGuest();
}
