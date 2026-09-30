import "server-only";
import { AiConfigurationError } from "./errors";
import { createGoogleCloudSpeechModel, createGoogleImageModel, createGoogleSpeechModel } from "./google/models";

import { createOpenAI } from "@ai-sdk/openai";
import type { ImageModel, LanguageModel, SpeechModel } from "ai";

import type {
  ChatScenario,
  ImageKind,
  MissionDraftScenario,
} from "./contracts";
import {
  type AiApiMode,
  type AiProviderName,
  readAiRuntimeConfig,
  resolveChatModelId,
} from "./config";
import {
  createMockImageModel,
  createMockLanguageModel,
  createMockSpeechModel,
} from "./mock-models";
import { proxyLanguageModel } from "./proxy-language-model";

import type { AiOperation } from "./provider-policy";
export type { AiOperation } from "./provider-policy";

export type AiCapabilities = {
  languageModel: LanguageModel;
  imageModel: ImageModel;
  speechModel: SpeechModel;
  providerName: AiProviderName;
  apiMode: AiApiMode;
  modelIds: {
    chat: string;
    image: string;
    speech: string;
  };
};

export function createAiCapabilities(options: {
  operation: AiOperation;
  scenario?: ChatScenario | MissionDraftScenario;
  imageKind?: ImageKind;
  modelId?: string;
}): AiCapabilities {
  const config = readAiRuntimeConfig(options.operation);
  const selectedChatModel = resolveChatModelId(options.modelId);

  const modelIds = { ...config.models, chat: selectedChatModel };

  if (config.providerName === "mock") {
    return {
      languageModel: createMockLanguageModel({
        modelId: selectedChatModel,
        operation: options.operation,
        scenario: options.scenario,
      }),
      imageModel: createMockImageModel(
        config.models.image,
        options.imageKind ?? "avatar",
      ),
      speechModel: createMockSpeechModel(config.models.speech),
      providerName: config.providerName,
      apiMode: config.apiMode,
      modelIds,
    };
  }

  if (config.providerName === "google-cloud-tts") {
    return {
      get languageModel(): LanguageModel { throw new AiConfigurationError("Cloud TTS does not provide a chat model."); },
      get imageModel(): ImageModel { throw new AiConfigurationError("Cloud TTS does not provide an image model."); },
      speechModel: createGoogleCloudSpeechModel(config.models.speech, { apiKey: config.apiKey! }),
      providerName: config.providerName, apiMode: config.apiMode, modelIds,
    };
  }

  if (config.providerName === "google") {
    // Only media operations select Google. Chat continues through its configured provider.
    return { get languageModel(): LanguageModel { throw new AiConfigurationError("Google media configuration does not provide a chat model."); }, imageModel: createGoogleImageModel(config.models.image, { apiKey: config.apiKey! }), speechModel: createGoogleSpeechModel(config.models.speech, { apiKey: config.apiKey! }), providerName: "google", apiMode: config.apiMode, modelIds };
  }

  const provider = createOpenAI({
    baseURL: config.baseURL,
    apiKey:
      config.providerName === "oauth-proxy"
        ? config.apiKey ?? "oauth-proxy-managed"
        : config.apiKey,
  });

  const languageModel = config.apiMode === "chat-completions"
    ? provider.chat(selectedChatModel)
    : provider.responses(selectedChatModel);

  return {
    // This proxy completes Responses requests as JSON even when stream=true.
    // Generate first, then let the SDK emit text, reasoning, tools, usage and
    // finish parts through its normal stream contract.
    languageModel: config.providerName === "oauth-proxy"
      ? proxyLanguageModel(languageModel)
      : languageModel,
    imageModel: provider.image(config.models.image),
    speechModel: provider.speech(config.models.speech),
    providerName: config.providerName,
    apiMode: config.apiMode,
    modelIds,
  };
}
