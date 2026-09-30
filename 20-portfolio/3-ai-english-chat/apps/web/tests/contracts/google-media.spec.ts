import { expect, test } from "@playwright/test";
import { downloadGoogleVideo, generateGoogleImage, generateGoogleSpeech, imageAspectRatio, pcmToWav, pollGoogleVideo, startGoogleVideo, googleVoice, GoogleMediaError } from "../../src/shared/api/ai/google/media";
import { signVideoOperation, verifyVideoOperation } from "../../src/shared/api/ai/google/video-token";
import { operationProviderOverride } from "../../src/shared/api/ai/provider-policy";

const captured: Array<{ url: string; options?: RequestInit }> = [];
function transport(payload: unknown, status = 200) {
  return { apiKey: "contract-test-secret", fetch: (async (url, options) => {
    captured.push({ url: String(url), options });
    return Response.json(payload, { status });
  }) as typeof fetch };
}
test.beforeEach(() => { captured.length = 0; });

test("Google image override leaves chat selection intact and mock stays offline", () => {
  expect(operationProviderOverride("image", { AI_IMAGE_PROVIDER: "google" })).toBe("google");
  expect(operationProviderOverride("speech", { AI_SPEECH_PROVIDER: "google" })).toBe("google");
  expect(operationProviderOverride("chat", { AI_IMAGE_PROVIDER: "google" })).toBeUndefined();
  expect(operationProviderOverride("image", { APP_RUNTIME_MODE: "mock", AI_IMAGE_PROVIDER: "google" })).toBe("mock");
});
test("image request uses fixed Google origin, header secret and aspect ratio; skips thought images", async () => {
  const generated = await generateGoogleImage(transport({ candidates: [{ content: { parts: [
    { thought: true, inlineData: { mimeType: "image/png", data: Buffer.from("thought").toString("base64") } },
    { inlineData: { mimeType: "image/png", data: Buffer.from("final").toString("base64") } },
  ] } }] }), { model: "gemini-3.1-flash-image-preview", prompt: "Portrait of a friendly character", size: "1024x1536" });
  expect(Buffer.from(generated.bytes).toString()).toBe("final");
  expect(captured[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent");
  expect(captured[0].url).not.toContain("contract-test-secret");
  expect(JSON.parse(String(captured[0].options?.body)).generationConfig.imageConfig).toEqual({ aspectRatio: "2:3", imageSize: "1K" });
  expect(imageAspectRatio("1536x1024")).toBe("3:2");
});
test("speech converts PCM into playable WAV and maps existing voice preference", async () => {
  const pcm = new Uint8Array([0, 0, 1, 0]);
  const generated = await generateGoogleSpeech(transport({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: Buffer.from(pcm).toString("base64") } }] } }] }), { model: "gemini-2.5-flash-preview-tts", text: "Hello", voice: "marin", speed: 0.8 });
  expect(generated.mediaType).toBe("audio/wav");
  expect(Buffer.from(generated.bytes.subarray(0, 4)).toString()).toBe("RIFF");
  expect(new DataView(generated.bytes.buffer).getUint32(24, true)).toBe(24000);
  expect(generated.bytes.subarray(44)).toEqual(pcm);
  const body = JSON.parse(String(captured[0].options?.body));
  expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Kore");
  expect(googleVoice("Puck")).toBe("Puck");
  expect(() => googleVoice("invented")).toThrow(GoogleMediaError);
  expect(() => pcmToWav(new Uint8Array([1]))).toThrow(GoogleMediaError);
});
test("blocked media and provider errors never return raw provider details", async () => {
  await expect(generateGoogleImage(transport({ candidates: [{ finishReason: "SAFETY" }] }), { model: "image", prompt: "some portrait" })).rejects.toThrow(GoogleMediaError);
  try { await generateGoogleImage(transport({ error: { message: "secret upstream diagnostic" } }, 429), { model: "image", prompt: "portrait" }); }
  catch (error) { expect(error).toBeInstanceOf(GoogleMediaError); expect(String(error)).not.toContain("secret upstream"); expect((error as GoogleMediaError).retryable).toBe(true); }
});
test("video uses asynchronous start/poll and rejects arbitrary provider URLs", async () => {
  const operation = "models/veo-3.1-fast-generate-preview/operations/task_123";
  expect(await startGoogleVideo(transport({ name: operation }), { model: "veo-3.1-fast-generate-preview", prompt: "Friendly character waves", aspectRatio: "9:16" })).toBe(operation);
  expect(JSON.parse(String(captured[0].options?.body)).parameters.durationSeconds).toBe(8);
  expect(await pollGoogleVideo(transport({ done: false }), operation)).toEqual({ done: false });
  await expect(pollGoogleVideo(transport({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: "https://attacker.example/file.mp4" } }] } } }), operation)).rejects.toThrow(GoogleMediaError);
  await expect(pollGoogleVideo(transport({}), "../../secret")).rejects.toThrow(GoogleMediaError);
});
test("signed video operation requires the same owner, valid signature and unexpired lease", () => {
  const token = signVideoOperation({ operation: "operations/task", ownerId: "owner", expiresAt: 2000 }, "secret");
  expect(verifyVideoOperation(token, "owner", 1000, "secret")).toBe("operations/task");
  expect(verifyVideoOperation(token, "other-owner", 1000, "secret")).toBeUndefined();
  expect(verifyVideoOperation(token, "owner", 2000, "secret")).toBeUndefined();
  expect(verifyVideoOperation(`${token}x`, "owner", 1000, "secret")).toBeUndefined();
  expect(verifyVideoOperation(token, "owner", 1000, "other-secret")).toBeUndefined();
});

test("video download keeps key on Gemini origin and strips it before trusted Storage redirect", async () => {
  const requests: Array<{ url: string; headers: Headers }> = [];
  const client = { apiKey: "never-forward", fetch: (async (url, options) => {
    requests.push({ url: String(url), headers: new Headers(options?.headers) });
    return requests.length === 1 ? new Response(null, { status: 302, headers: { location: "https://storage.googleapis.com/generated/video.mp4" } }) : new Response("video", { headers: { "Content-Type": "video/mp4" } });
  }) as typeof fetch };
  const response = await downloadGoogleVideo(client, "https://generativelanguage.googleapis.com/v1beta/files/video:download");
  expect(await response.text()).toBe("video");
  expect(requests[0].headers.get("x-goog-api-key")).toBe("never-forward");
  expect(requests[1].headers.has("x-goog-api-key")).toBe(false);
  await expect(downloadGoogleVideo({ apiKey: "secret", fetch: (async () => new Response(null, { status: 302, headers: { location: "https://evil.example/video" } })) as typeof fetch }, "https://generativelanguage.googleapis.com/v1beta/files/video:download")).rejects.toThrow(GoogleMediaError);
});

test("current Nano Banana 2 uses documented Interactions REST and final image block", async () => {
  const image = await generateGoogleImage(transport({ steps: [{ type: "thought", summary: [{ type: "image", data: "ignored" }] }, { type: "model_output", content: [{ type: "image", mime_type: "image/png", data: Buffer.from("current").toString("base64") }] }] }), { model: "gemini-3.1-flash-image", prompt: "A friendly tutor portrait", size: "1536x1024" });
  expect(Buffer.from(image.bytes).toString()).toBe("current");
  expect(captured[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
  expect(JSON.parse(String(captured[0].options?.body))).toEqual({ model: "gemini-3.1-flash-image", input: "A friendly tutor portrait", response_format: { type: "image", aspect_ratio: "3:2", image_size: "1K" }, store: false });
});
test("current Gemini TTS keeps supplied text separate from voice style and accepts WAV", async () => {
  const wave = pcmToWav(new Uint8Array([1, 0]));
  const audio = await generateGoogleSpeech(transport({ steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: Buffer.from(wave).toString("base64") }] }] }), { model: "gemini-3.8-flash-tts", text: "Hello there", voice: "marin", speed: 1 });
  expect(audio.bytes).toEqual(wave);
  const body = JSON.parse(String(captured[0].options?.body));
  expect(body.input[0].content[0].text).toBe("Hello there");
  expect(body.generation_config.speech_config).toEqual([{ voice: "Kore" }]);
  expect(body.response_format).toEqual({ type: "audio", mime_type: "audio/wav" });
});
