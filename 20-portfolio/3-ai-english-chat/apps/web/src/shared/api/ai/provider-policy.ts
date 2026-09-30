export type AiProviderName = "mock" | "oauth-proxy" | "openai" | "google" | "google-cloud-tts";
export type AiOperation = "chat" | "mission-draft" | "learning-assistance" | "image" | "speech";

/** A production build still honors an explicitly selected server-side provider. */
export function runtimeProviderName(
  environment: Readonly<Record<string, string | undefined>>,
): AiProviderName {
  const configured = environment.AI_PROVIDER?.trim();
  if (environment.APP_RUNTIME_MODE?.trim() === "mock" || configured === "mock") return "mock";
  if (configured && configured !== "openai" && configured !== "oauth-proxy") {
    throw new Error("AI_PROVIDER is invalid.");
  }
  if (configured === "openai" || configured === "oauth-proxy") return configured;
  return environment.NODE_ENV === "production" ? "openai" : "oauth-proxy";
}

/** Resolve an explicit media override without reading credentials or changing chat routing. */
export function operationProviderOverride(
  operation: AiOperation,
  environment: Readonly<Record<string, string | undefined>>,
): AiProviderName | undefined {
  if (environment.APP_RUNTIME_MODE?.trim() === "mock" || environment.AI_PROVIDER?.trim() === "mock") return "mock";
  const name = operation === "image" ? "AI_IMAGE_PROVIDER" : operation === "speech" ? "AI_SPEECH_PROVIDER" : undefined;
  if (!name) return undefined;
  const value = environment[name]?.trim();
  if (!value) return undefined;
  if (operation === "speech" && value === "google-cloud-tts") return value;
  if (value !== "mock" && value !== "openai" && value !== "oauth-proxy" && value !== "google") {
    throw new Error(`${name} is invalid.`);
  }
  return value;
}
