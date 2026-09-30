import { expect, test } from "@playwright/test";
import { CloudSpeechInputError, generateGoogleCloudSpeech } from "../../src/shared/api/ai/google/cloud-speech";
import { GoogleMediaError, pcmToWav } from "../../src/shared/api/ai/google/media";
import { operationProviderOverride } from "../../src/shared/api/ai/provider-policy";

test("Cloud TTS is speech-only and cannot replace the image or chat provider", () => {
  expect(operationProviderOverride("speech", { AI_SPEECH_PROVIDER: "google-cloud-tts" })).toBe("google-cloud-tts");
  expect(operationProviderOverride("chat", { AI_SPEECH_PROVIDER: "google-cloud-tts" })).toBeUndefined();
  expect(() => operationProviderOverride("image", { AI_IMAGE_PROVIDER: "google-cloud-tts" })).toThrow();
  expect(operationProviderOverride("speech", { AI_PROVIDER: "mock", AI_SPEECH_PROVIDER: "google-cloud-tts" })).toBe("mock");
});

test("Cloud TTS uses its own host, maps the saved voice and retains the original WAV header", async () => {
  const wav = pcmToWav(new Uint8Array([0, 0, 1, 0]));
  const result = await generateGoogleCloudSpeech({ apiKey: "cloud-contract-key", fetch: (async (url, options) => {
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "cloud-contract-key" });
    expect(options?.redirect).toBe("error");
    expect(JSON.parse(String(options?.body))).toEqual({ input: { text: "Welcome!" }, voice: { languageCode: "en-US", name: "en-US-Chirp3-HD-Kore" }, audioConfig: { audioEncoding: "LINEAR16", speakingRate: 0.8, sampleRateHertz: 24000 } });
    return Response.json({ audioContent: Buffer.from(wav).toString("base64") });
  }) as typeof fetch }, { text: "Welcome!", voice: "marin", speed: 0.8 });
  expect(result.bytes).toEqual(wav);
  expect(result.mediaType).toBe("audio/wav");
});

test("Cloud TTS rejects multibyte oversize input before sending a request", async () => {
  let calls = 0;
  await expect(generateGoogleCloudSpeech({ apiKey: "unused", fetch: (async () => { calls++; return Response.json({}); }) as typeof fetch }, { text: "가".repeat(1667) })).rejects.toBeInstanceOf(CloudSpeechInputError);
  expect(calls).toBe(0);
});

test("Cloud TTS rejects malformed audio and never exposes provider error content", async () => {
  await expect(generateGoogleCloudSpeech({ apiKey: "unused", fetch: (async () => Response.json({ audioContent: "bm90LXdhdg==" })) as typeof fetch }, { text: "Hello" })).rejects.toMatchObject({ status: 502 });
  try {
    await generateGoogleCloudSpeech({ apiKey: "unused", fetch: (async () => Response.json({ error: { message: "secret-provider-detail" } }, { status: 403 })) as typeof fetch }, { text: "Hello" });
    throw new Error("Expected provider rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(GoogleMediaError);
    expect(String(error)).not.toContain("secret-provider-detail");
  }
});
