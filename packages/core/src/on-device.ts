type PromptApi = { availability(): Promise<string> };

export async function deviceModelReady() {
  const { LanguageModel } = globalThis as typeof globalThis & { LanguageModel?: PromptApi };
  return (await LanguageModel?.availability()) === "available";
}
