import { expect, test } from "@playwright/test";
import { operationProviderOverride } from "../../src/shared/api/ai/provider-policy";

test("media defaults inherit existing provider and never redirect chat or drafts", () => {
  for (const operation of ["chat", "mission-draft", "learning-assistance", "image", "speech"] as const) {
    expect(operationProviderOverride(operation, { AI_PROVIDER: "oauth-proxy" })).toBeUndefined();
  }
  for (const operation of ["chat", "mission-draft", "learning-assistance"] as const) {
    expect(operationProviderOverride(operation, { AI_IMAGE_PROVIDER: "openai", AI_SPEECH_PROVIDER: "openai" })).toBeUndefined();
  }
});

test("image and speech override independently without modifying environment or selecting credentials", () => {
  const environment = Object.freeze({ AI_PROVIDER: "oauth-proxy", AI_IMAGE_PROVIDER: " openai ", AI_SPEECH_PROVIDER: "oauth-proxy" });
  expect(operationProviderOverride("image", environment)).toBe("openai");
  expect(operationProviderOverride("speech", environment)).toBe("oauth-proxy");
  expect(environment.AI_PROVIDER).toBe("oauth-proxy");
  expect(operationProviderOverride("image", { AI_PROVIDER: "mock", AI_IMAGE_PROVIDER: "openai" })).toBe("mock");
});

test("blank media settings inherit and invalid configuration never silently becomes mock", () => {
  expect(operationProviderOverride("image", { AI_IMAGE_PROVIDER: "  " })).toBeUndefined();
  expect(() => operationProviderOverride("image", { AI_IMAGE_PROVIDER: "unsupported" })).toThrow("AI_IMAGE_PROVIDER is invalid.");
  expect(() => operationProviderOverride("speech", { AI_SPEECH_PROVIDER: "unsupported" })).toThrow("AI_SPEECH_PROVIDER is invalid.");
  expect(operationProviderOverride("image", { AI_IMAGE_PROVIDER: "mock" })).toBe("mock");
});

test("explicit mock application runtime keeps deterministic tests offline despite media overrides", () => {
  for (const operation of ["chat", "mission-draft", "learning-assistance", "image", "speech"] as const) {
    expect(operationProviderOverride(operation, { APP_RUNTIME_MODE: "mock", AI_IMAGE_PROVIDER: "openai", AI_SPEECH_PROVIDER: "openai" })).toBe("mock");
  }
});
