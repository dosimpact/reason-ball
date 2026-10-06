import * as R from "remeda";
export const defaultPrompt =
  "Summarize the voice input, preserve important keywords, and explain what the speaker asked for.";

export const alternatePrompt =
  "Extract the transcript, key phrases, audio metadata, and a concise final response for a reviewer.";

export const maxAudioBytes = 5_000_000;

export const supportedAudioTypes = [
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
];

export type JsonRecord = Record<string, unknown>;

export type AudioMetadata = {
  name: string;
  mimeType: string;
  size: number;
  durationMs: number;
  source: string;
};

export type VoiceEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

export type VoiceNote = {
  label: string;
  detail: string;
  confidence: number;
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

export function seconds(ms: number) {
  if (!ms) return "unknown";
  return `${(ms / 1000).toFixed(1)} seconds`;
}

export function base64ByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

export function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (key, child) => {
      if ((key === "data_url" || key === "audio_data_url") && R.isString(child) && child.startsWith("data:audio")) {
        return `[audio data URL: ${child.length} chars]`;
      }
      return child;
    },
    2,
  );
}

export function normalizeMetadata(value: unknown): AudioMetadata | null {
  if (!R.isPlainObject(value)) return null;
  return {
    name: R.isString(value.name) ? value.name : "audio",
    mimeType: R.isString(value.mime_type) ? value.mime_type : "",
    size: numberValue(value.size),
    durationMs: numberValue(value.duration_ms),
    source: R.isString(value.source) ? value.source : "",
  };
}

export function normalizeVoiceEvents(value: unknown): VoiceEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "27_multimodal_voice_input",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function normalizeVoiceNotes(value: unknown): VoiceNote[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((note) => ({
      label: R.isString(note.label) ? note.label : "Note",
      detail: R.isString(note.detail) ? note.detail : "",
      confidence: numberValue(note.confidence),
    })));
}

export function normalizeKeyPhrases(value: unknown): string[] {
  if (!R.isArray(value)) return [];
  return R.filter(value, R.isString);
}

export function mergeVoiceEvents(current: VoiceEvent[], next: VoiceEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}
