import "server-only";

import { AiConfigurationError, AiHttpError } from "./errors";
import { allowedChatModels, isAllowedChatModel } from "./model-policy";
import { buildChatModelEntries } from './model-catalog';

export const DEFAULT_CHAT_MODEL = "gpt-5.6-terra";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_SPEECH_MODEL = "gpt-4o-mini-tts";

export type AiProviderName = "mock" | "oauth-proxy" | "openai";
export type AiApiMode = "chat-completions" | "responses";

export type AiRuntimeConfig = {
  providerName: AiProviderName;
  apiMode: AiApiMode;
  models: {
    chat: string;
    image: string;
    speech: string;
  };
  apiKey?: string;
  baseURL?: string;
};

function readModelId(primaryName: string, legacyName: string, fallback: string) {
  return (
    process.env[primaryName]?.trim() ||
    process.env[legacyName]?.trim() ||
    fallback
  );
}

export function resolveChatModelId(requested?: string): string {
  const defaultModel = readModelId("AI_CHAT_MODEL", "OPENAI_MODEL", DEFAULT_CHAT_MODEL);
  const selected = requested ?? defaultModel;
  if (!isAllowedChatModel(selected, defaultModel, process.env.AI_ALLOWED_CHAT_MODELS)) {
    throw new AiHttpError(400, "MODEL_NOT_ALLOWED", "The requested AI model is not available.");
  }
  return selected;
}

export function readChatModelCatalog() {
  const defaultModelId = readModelId("AI_CHAT_MODEL", "OPENAI_MODEL", DEFAULT_CHAT_MODEL);
  try {
    const items = buildChatModelEntries(
      allowedChatModels(defaultModelId, process.env.AI_ALLOWED_CHAT_MODELS),
      process.env.AI_CHAT_MODEL_CAPABILITIES,
      process.env.APP_RUNTIME_MODE?.trim() === 'mock' || process.env.AI_PROVIDER?.trim() === 'mock',
    );
    return { defaultModelId, items };
  } catch {
    throw new AiConfigurationError('AI_CHAT_MODEL_CAPABILITIES is invalid.');
  }
}

function readApiMode(): AiApiMode {
  const value = process.env.AI_API_MODE?.trim() || "responses";
  if (value !== "chat-completions" && value !== "responses") {
    throw new AiConfigurationError("AI_API_MODE is invalid.");
  }

  return value;
}

function readProviderName(): AiProviderName {
  const configuredProvider = process.env.AI_PROVIDER?.trim();
  const isMock =
    process.env.APP_RUNTIME_MODE?.trim() === "mock" ||
    configuredProvider === "mock";

  if (isMock) {
    return "mock";
  }

  if (
    configuredProvider &&
    configuredProvider !== "openai" &&
    configuredProvider !== "oauth-proxy"
  ) {
    throw new AiConfigurationError("AI_PROVIDER is invalid.");
  }

  if (process.env.NODE_ENV === "production") {
    return "openai";
  }

  return configuredProvider === "openai" ? "openai" : "oauth-proxy";
}

function readProxyBaseUrl() {
  const rawUrl = process.env.CHATGPT_OAUTH_PROXY_URL?.trim();
  if (!rawUrl) {
    throw new AiConfigurationError("CHATGPT_OAUTH_PROXY_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AiConfigurationError("CHATGPT_OAUTH_PROXY_URL is invalid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AiConfigurationError("CHATGPT_OAUTH_PROXY_URL is invalid.");
  }

  return rawUrl.replace(/\/+$/, "");
}

export function readAiRuntimeConfig(): AiRuntimeConfig {
  const providerName = readProviderName();
  const models = {
    chat: readModelId("AI_CHAT_MODEL", "OPENAI_MODEL", DEFAULT_CHAT_MODEL),
    image: readModelId(
      "AI_IMAGE_MODEL",
      "OPENAI_IMAGE_MODEL",
      DEFAULT_IMAGE_MODEL,
    ),
    speech: readModelId(
      "AI_SPEECH_MODEL",
      "OPENAI_SPEECH_MODEL",
      DEFAULT_SPEECH_MODEL,
    ),
  };

  if (providerName === "mock") {
    return {
      providerName,
      apiMode: readApiMode(),
      models,
    };
  }

  if (providerName === "oauth-proxy") {
    return {
      providerName,
      apiMode: readApiMode(),
      models,
      baseURL: readProxyBaseUrl(),
      apiKey: process.env.CHATGPT_OAUTH_PROXY_TOKEN?.trim() || undefined,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigurationError("OPENAI_API_KEY is required.");
  }

  return {
    providerName,
    apiMode: readApiMode(),
    models,
    apiKey,
  };
}
