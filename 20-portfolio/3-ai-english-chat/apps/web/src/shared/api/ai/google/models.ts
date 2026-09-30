import "server-only";
import type { ImageModel, SpeechModel } from "ai";
import { generateGoogleImage, generateGoogleSpeech, type GoogleTransport } from "./media";
import { generateGoogleCloudSpeech } from "./cloud-speech";

export function createGoogleCloudSpeechModel(modelId: string, transport: GoogleTransport): SpeechModel {
  return {
    specificationVersion: "v4", provider: "google-cloud-tts", modelId,
    async doGenerate(options) {
      const result = await generateGoogleCloudSpeech(transport, { text: options.text, voice: options.voice, speed: options.speed, signal: options.abortSignal });
      return { audio: result.bytes, warnings: [], response: { timestamp: new Date(), modelId } };
    },
  };
}

export function createGoogleImageModel(modelId: string, transport: GoogleTransport): ImageModel {
  return {
    specificationVersion: "v4", provider: "google", modelId, maxImagesPerCall: 1,
    async doGenerate(options) {
      const result = await generateGoogleImage(transport, { model: modelId, prompt: options.prompt ?? "", size: options.size, signal: options.abortSignal });
      return { images: [result.bytes], warnings: [], response: { timestamp: new Date(), modelId, headers: undefined } };
    },
  };
}
export function createGoogleSpeechModel(modelId: string, transport: GoogleTransport): SpeechModel {
  return {
    specificationVersion: "v4", provider: "google", modelId,
    async doGenerate(options) {
      const result = await generateGoogleSpeech(transport, { model: modelId, text: options.text, voice: options.voice, speed: options.speed, signal: options.abortSignal });
      return { audio: result.bytes, warnings: [], response: { timestamp: new Date(), modelId } };
    },
  };
}
