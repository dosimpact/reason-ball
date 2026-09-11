export type AiProviderName = "mock" | "oauth-proxy" | "openai";
export type AiOperation = "chat" | "mission-draft" | "learning-assistance" | "image" | "speech";

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
  if (value !== "mock" && value !== "openai" && value !== "oauth-proxy") {
    throw new Error(`${name} is invalid.`);
  }
  return value;
}
