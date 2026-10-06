import * as R from "remeda";
export const defaultPrompt =
  "Create a short spoken update that explains why LangGraph SDK voice output is useful for product demos.";

export const defaultInstructions = "Speak clearly, warmly, and at a measured pace.";

export const voices = ["coral", "alloy", "nova", "sage", "shimmer", "echo", "onyx", "ash"];

export const formats = ["mp3", "wav", "aac", "opus", "flac"];

export type JsonRecord = Record<string, unknown>;

export type AudioOutput = {
  dataUrl: string;
  mimeType: string;
  format: string;
  size: number;
  voice: string;
  model: string;
  filename: string;
};

export type AudioEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

export type SpeechSettings = {
  voice: string;
  responseFormat: string;
  instructions: string;
  model: string;
};



export function valuesOf(state: unknown): JsonRecord {
  if (R.isPlainObject(state) && R.isPlainObject(state.values)) return state.values;
  return R.isPlainObject(state) ? state : {};
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!R.isPlainObject(data)) return [];
  return R.filter(R.values(data), R.isPlainObject);
}

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (key, child) => {
      if (
        (key === "data_url" || key === "audio_data_url") &&
        R.isString(child) &&
        child.startsWith("data:audio")
      ) {
        return `[audio data URL: ${child.length} chars]`;
      }
      return child;
    },
    2,
  );
}

export function normalizeAudioOutput(value: unknown): AudioOutput | null {
  if (!R.isPlainObject(value)) return null;
  return {
    dataUrl: R.isString(value.data_url) ? value.data_url : "",
    mimeType: R.isString(value.mime_type) ? value.mime_type : "",
    format: R.isString(value.format) ? value.format : "",
    size: numberValue(value.size),
    voice: R.isString(value.voice) ? value.voice : "",
    model: R.isString(value.model) ? value.model : "",
    filename: R.isString(value.filename) ? value.filename : "langgraph-voice-output.mp3",
  };
}

export function normalizeAudioEvents(value: unknown): AudioEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "28_multimodal_voice_output",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function normalizeSpeechSettings(value: unknown): SpeechSettings | null {
  if (!R.isPlainObject(value)) return null;
  return {
    voice: R.isString(value.voice) ? value.voice : "",
    responseFormat: R.isString(value.response_format) ? value.response_format : "",
    instructions: R.isString(value.instructions) ? value.instructions : "",
    model: R.isString(value.model) ? value.model : "",
  };
}

export function mergeAudioEvents(current: AudioEvent[], next: AudioEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}
