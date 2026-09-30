import "server-only";
import { GOOGLE_MEDIA_MODELS } from "./google/media";
import { GOOGLE_CLOUD_SPEECH_MODEL } from "./google/cloud-speech";

import { AiConfigurationError, AiHttpError } from "./errors";
import { allowedChatModels, isAllowedChatModel } from "./model-policy";
import { buildChatModelEntries } from './model-catalog';

export const DEFAULT_CHAT_MODEL = "gpt-5.6-terra";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_SPEECH_MODEL = "gpt-4o-mini-tts";

import { operationProviderOverride, runtimeProviderName, type AiProviderName, type AiOperation } from "./provider-policy";
export type { AiProviderName } from "./provider-policy";
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
  try {
    return runtimeProviderName(process.env);
  } catch (cause) {
    throw new AiConfigurationError(cause instanceof Error ? cause.message : "AI_PROVIDER is invalid.");
  }
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

export function readAiRuntimeConfig(operation: AiOperation = "chat"): AiRuntimeConfig {
  let override: AiProviderName | undefined;
  try { override = operationProviderOverride(operation, process.env); }
  catch (cause) { throw new AiConfigurationError(cause instanceof Error ? cause.message : "AI provider override is invalid."); }
  const providerName = override ?? readProviderName();
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

  if (providerName === "google-cloud-tts") {
    const apiKey = process.env.GOOGLE_TTS_API_KEY?.trim() || process.env.GOOGLE_CLOUD_TTS_API_KEY?.trim();
    if (!apiKey) throw new AiConfigurationError("GOOGLE_TTS_API_KEY is required.");
    const speech = process.env.AI_SPEECH_MODEL?.trim() || GOOGLE_CLOUD_SPEECH_MODEL;
    if (speech !== GOOGLE_CLOUD_SPEECH_MODEL) throw new AiConfigurationError("Cloud TTS currently supports AI_SPEECH_MODEL=chirp-3-hd.");
    return { providerName, apiMode: readApiMode(), apiKey, models: { ...models, speech } };
  }

  if (providerName === "google") {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new AiConfigurationError("GOOGLE_GENERATIVE_AI_API_KEY is required.");
    return { providerName, apiMode: readApiMode(), apiKey, models: { ...models, image: process.env.AI_IMAGE_MODEL?.trim() || GOOGLE_MEDIA_MODELS.image, speech: process.env.AI_SPEECH_MODEL?.trim() || GOOGLE_MEDIA_MODELS.speech } };
  }

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
