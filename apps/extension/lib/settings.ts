import { messageLimit, systemPrompt } from "@bifocal/core";
import { ensureInitialized, fetchAndActivate, getRemoteConfig, getString, isSupported } from "firebase/remote-config";
import type { RemoteConfig } from "firebase/remote-config";
import { firebaseApp, liveFirebase } from "./firebase";
import { defaultPageSettings, pageSettingsKey } from "./page-checks";

const allowedModel = /^gemini-[\w.-]{1,64}$/;

const defaults = {
  prompt_version: "1",
  system_prompt: systemPrompt,
  cloud_model_screen: "gemini-3.5-flash-lite",
  cloud_model_deep: "gemini-3.8-flash",
  pause_triggers: defaultPageSettings.triggers.join(","),
  remote_access_tools: defaultPageSettings.tools,
  max_chars_on_device: String(messageLimit),
  risky_page_signals: defaultPageSettings.signals.join(","),
};

export const modelSettings = { ...defaults };

async function applySettings(remote: RemoteConfig) {
  for (const key of ["cloud_model_screen", "cloud_model_deep"] as const) {
    const value = getString(remote, key);
    if (allowedModel.test(value)) modelSettings[key] = value;
  }
  const prompt = getString(remote, "system_prompt").trim();
  if (prompt && prompt.length <= 10_000) modelSettings.system_prompt = prompt;
  modelSettings.prompt_version = getString(remote, "prompt_version");
  const limit = Number(getString(remote, "max_chars_on_device"));
  if (Number.isSafeInteger(limit) && limit >= 1_000 && limit <= messageLimit) {
    modelSettings.max_chars_on_device = String(limit);
  }

  await chrome.storage.local.set({
    [pageSettingsKey]: {
      triggers: getString(remote, "pause_triggers").split(",").filter((trigger) => defaultPageSettings.triggers.includes(trigger)),
      tools: getString(remote, "remote_access_tools").slice(0, 500),
      signals: getString(remote, "risky_page_signals").split(",").filter((signal) => defaultPageSettings.signals.includes(signal)),
    },
  });
}

export async function syncSettings() {
  if (!liveFirebase || !firebaseApp || !await isSupported()) return;
  const remote = getRemoteConfig(firebaseApp);
  remote.defaultConfig = defaults;
  remote.settings.fetchTimeoutMillis = 5_000;
  await ensureInitialized(remote);
  await applySettings(remote);

  if (navigator.onLine && await fetchAndActivate(remote).catch(() => false)) {
    await applySettings(remote);
  }
}
