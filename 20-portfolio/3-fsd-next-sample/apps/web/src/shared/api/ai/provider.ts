import "server-only";

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

export type AiOperation = "chat" | "mission-draft" | "learning-assistance" | "image" | "speech";

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
  const config = readAiRuntimeConfig();
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

  const provider = createOpenAI({
    baseURL: config.baseURL,
    apiKey:
      config.providerName === "oauth-proxy"
        ? config.apiKey ?? "oauth-proxy-managed"
        : config.apiKey,
  });

  return {
    languageModel:
      config.apiMode === "chat-completions"
        ? provider.chat(selectedChatModel)
        : provider.responses(selectedChatModel),
    imageModel: provider.image(config.models.image),
    speechModel: provider.speech(config.models.speech),
    providerName: config.providerName,
    apiMode: config.apiMode,
    modelIds,
  };
}
