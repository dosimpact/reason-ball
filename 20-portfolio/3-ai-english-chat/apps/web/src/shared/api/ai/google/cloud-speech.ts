import { GoogleMediaError, googleVoice, type GoogleTransport } from "./media";

export const GOOGLE_CLOUD_SPEECH_MODEL = "chirp-3-hd";
export class CloudSpeechInputError extends Error {}

/** Cloud TTS uses a different service and credential from the Gemini Developer API. */
export async function generateGoogleCloudSpeech(config: GoogleTransport, input: {
  text: string; voice?: string; speed?: number; signal?: AbortSignal;
}) {
  if (!input.text.trim() || new TextEncoder().encode(input.text).byteLength > 5000) {
    throw new CloudSpeechInputError("Cloud TTS requires between 1 and 5,000 UTF-8 bytes of text.");
  }
  const response = await (config.fetch ?? fetch)("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: input.text },
      voice: { languageCode: "en-US", name: `en-US-Chirp3-HD-${googleVoice(input.voice)}` },
      audioConfig: { audioEncoding: "LINEAR16", speakingRate: input.speed ?? 1, sampleRateHertz: 24000 },
    }),
    signal: input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    redirect: "error",
  });
  if (!response.ok) throw new GoogleMediaError(response.status, response.status === 429 || response.status >= 500);
  const payload = await response.json();
  if (typeof payload.audioContent !== "string" || payload.audioContent.length > 32 * 1024 * 1024) throw new GoogleMediaError(502, true);
  const bytes = Buffer.from(payload.audioContent, "base64");
  // LINEAR16 includes its WAV container. Do not wrap it in another RIFF header.
  if (bytes.length <= 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new GoogleMediaError(502, true);
  return { bytes: new Uint8Array(bytes), mediaType: "audio/wav" };
}
