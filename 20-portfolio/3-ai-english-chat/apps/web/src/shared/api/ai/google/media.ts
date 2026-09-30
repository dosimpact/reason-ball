/** Gemini REST media boundary. Credentials are supplied only by server callers. */
export const GOOGLE_MEDIA_MODELS = {
  image: "gemini-3.1-flash-image",
  speech: "gemini-3.8-flash-tts",
  video: "veo-3.1-fast-generate-preview",
} as const;
export const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GoogleMediaError extends Error {
  constructor(readonly status: number, readonly retryable: boolean) {
    super("The Google media service could not complete the request.");
    this.name = "GoogleMediaError";
  }
}

export type GoogleTransport = {
  apiKey: string;
  fetch?: typeof fetch;
};

export async function googleRequest(config: GoogleTransport, path: string, body?: unknown, signal?: AbortSignal) {
  const response = await (config.fetch ?? fetch)(`${GOOGLE_API_BASE}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    redirect: "error",
  });
  if (!response.ok) throw new GoogleMediaError(response.status, response.status === 429 || response.status >= 500);
  return response.json();
}

export function imageAspectRatio(size?: string) {
  return size === "1024x1536" ? "2:3" : size === "1536x1024" ? "3:2" : "1:1";
}

const googleVoices = new Set(["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr", "Achernar", "Alnilam", "Algieba", "Autonoe", "Callirrhoe", "Despina", "Enceladus", "Erinome", "Gacrux", "Iapetus", "Laomedeia", "Pulcherrima", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel", "Vindemiatrix", "Zubenelgenubi", "Achird", "Algenib"]);
const legacyVoices: Record<string, string> = { marin: "Kore", alloy: "Puck", ash: "Charon", ballad: "Fenrir", coral: "Aoede", echo: "Orus", fable: "Puck", nova: "Leda", onyx: "Charon", sage: "Zephyr", shimmer: "Aoede", verse: "Kore", cedar: "Orus" };
export function googleVoice(voice = "marin") {
  if (googleVoices.has(voice)) return voice;
  if (legacyVoices[voice]) return legacyVoices[voice];
  throw new GoogleMediaError(400, false);
}

/** Gemini 2.5 TTS emits little endian mono signed 16-bit PCM at 24 kHz. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000) {
  if (pcm.byteLength % 2 !== 0 || pcm.byteLength === 0) throw new GoogleMediaError(502, true);
  const result = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(result.buffer);
  const ascii = (offset: number, text: string) => result.set(new TextEncoder().encode(text), offset);
  ascii(0, "RIFF"); view.setUint32(4, 36 + pcm.byteLength, true); ascii(8, "WAVE");
  ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, "data");
  view.setUint32(40, pcm.byteLength, true); result.set(pcm, 44);
  return result;
}

type InlinePart = { thought?: boolean; inlineData?: { mimeType?: string; data?: string } };
function inlineMedia(payload: { candidates?: Array<{ content?: { parts?: InlinePart[] } }> }, prefix: string) {
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const part = parts.find((entry) => !entry.thought && entry.inlineData?.mimeType?.startsWith(prefix));
  if (!part?.inlineData?.data) throw new GoogleMediaError(502, true);
  if (part.inlineData.data.length > 32 * 1024 * 1024) throw new GoogleMediaError(502, false);
  return { bytes: new Uint8Array(Buffer.from(part.inlineData.data, "base64")), mediaType: part.inlineData.mimeType! };
}

type InteractionPayload = { steps?: Array<{ type?: string; content?: Array<{ type?: string; mime_type?: string; data?: string }> }> };
function interactionMedia(payload: InteractionPayload, type: "image" | "audio") {
  const blocks = payload.steps?.filter((step) => step.type === "model_output").flatMap((step) => step.content ?? []) ?? [];
  const block = blocks.findLast((entry) => entry.type === type && typeof entry.data === "string");
  if (!block?.data || block.data.length > 32 * 1024 * 1024 || !block.mime_type) throw new GoogleMediaError(502, true);
  return { bytes: new Uint8Array(Buffer.from(block.data, "base64")), mediaType: block.mime_type };
}

export async function generateGoogleImage(config: GoogleTransport, input: { model: string; prompt: string; size?: string; signal?: AbortSignal }) {
  const legacy = input.model.endsWith("-preview") || input.model === "gemini-2.5-flash-image";
  const result = legacy
    ? await googleRequest(config, `models/${encodeURIComponent(input.model)}:generateContent`, {
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: imageAspectRatio(input.size), imageSize: "1K" } },
    }, input.signal)
    : await googleRequest(config, "interactions", { model: input.model, input: input.prompt, response_format: { type: "image", aspect_ratio: imageAspectRatio(input.size), image_size: "1K" }, store: false }, input.signal);
  const image = legacy ? inlineMedia(result, "image/") : interactionMedia(result, "image");
  if (!["image/png", "image/jpeg", "image/webp"].includes(image.mediaType)) throw new GoogleMediaError(502, false);
  return image;
}

export async function generateGoogleSpeech(config: GoogleTransport, input: { model: string; text: string; voice?: string; speed?: number; signal?: AbortSignal }) {
  const voice = googleVoice(input.voice);
  const legacy = input.model === "gemini-2.5-flash-preview-tts" || input.model === "gemini-2.5-pro-preview-tts";
  const style = `Clear, warm, natural English for a beginner learner, at ${input.speed ?? 1}x normal speaking pace`;
  const result = legacy
    ? await googleRequest(config, `models/${encodeURIComponent(input.model)}:generateContent`, {
      contents: [{ role: "user", parts: [{ text: `Read the following text. ${style}. Speak only the supplied text:\n${input.text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }, input.signal)
    : await googleRequest(config, "interactions", { model: input.model, input: [{ type: "user_input", content: [{ type: "text", text: input.text, annotations: [{ type: "speech_metadata", style }] }] }], response_format: { type: "audio", mime_type: "audio/wav" }, generation_config: { speech_config: [{ voice }] }, store: false }, input.signal);
  const audio = legacy ? inlineMedia(result, "audio/") : interactionMedia(result, "audio");
  if (audio.mediaType === "audio/wav") return audio;
  if (!audio.mediaType.startsWith("audio/L16") && !audio.mediaType.startsWith("audio/l16") && !audio.mediaType.startsWith("audio/pcm")) throw new GoogleMediaError(502, false);
  return { bytes: pcmToWav(audio.bytes), mediaType: "audio/wav" };
}

export function validGoogleOperation(name: string) {
  return /^models\/veo-[a-z0-9.-]+\/operations\/[a-zA-Z0-9_-]+$/.test(name) || /^operations\/[a-zA-Z0-9_-]+$/.test(name);
}
export async function startGoogleVideo(config: GoogleTransport, input: { model: string; prompt: string; aspectRatio: "16:9" | "9:16"; signal?: AbortSignal }) {
  const result = await googleRequest(config, `models/${encodeURIComponent(input.model)}:predictLongRunning`, {
    instances: [{ prompt: input.prompt }], parameters: { aspectRatio: input.aspectRatio, durationSeconds: 8, resolution: "720p", sampleCount: 1 },
  }, input.signal);
  if (typeof result.name !== "string" || !validGoogleOperation(result.name)) throw new GoogleMediaError(502, false);
  return result.name as string;
}
export async function pollGoogleVideo(config: GoogleTransport, name: string, signal?: AbortSignal) {
  if (!validGoogleOperation(name)) throw new GoogleMediaError(400, false);
  const result = await googleRequest(config, name, undefined, signal);
  if (result.error) throw new GoogleMediaError(502, false);
  if (!result.done) return { done: false as const };
  const uri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (typeof uri !== "string") throw new GoogleMediaError(502, false);
  const url = new URL(uri);
  if (url.protocol !== "https:" || url.hostname !== "generativelanguage.googleapis.com" || !url.pathname.startsWith("/v1beta/files/")) throw new GoogleMediaError(502, false);
  return { done: true as const, uri };
}

/** Follow only Google-owned video redirects; never forward the API key to Storage. */
export async function downloadGoogleVideo(config: GoogleTransport, uri: string, signal?: AbortSignal) {
  let url = new URL(uri);
  const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const apiHost = url.hostname === "generativelanguage.googleapis.com";
    const storageHost = url.hostname === "storage.googleapis.com" || url.hostname.endsWith(".storage.googleapis.com");
    if (url.protocol !== "https:" || url.username || url.password || (!apiHost && !storageHost)) throw new GoogleMediaError(502, false);
    const response = await (config.fetch ?? fetch)(url.toString(), { headers: apiHost ? { "x-goog-api-key": config.apiKey } : {}, signal: abort, redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new GoogleMediaError(502, false);
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new GoogleMediaError(response.status, response.status === 429 || response.status >= 500);
    if (response.headers.get("content-type")?.split(";")[0] !== "video/mp4") throw new GoogleMediaError(502, false);
    return response;
  }
  throw new GoogleMediaError(502, false);
}
