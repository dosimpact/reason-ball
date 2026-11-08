import * as R from "remeda";
export const defaultPrompt =
  "Analyze this image for layout, visible text, colors, and UI-relevant details.";

export const alternatePrompt =
  "Describe the main subject, call out any readable labels, and provide region notes for review.";

export const maxImageBytes = 1_500_000;

export type JsonRecord = Record<string, unknown>;

export type ImageMetadata = {
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  source: string;
};

export type Observation = {
  label: string;
  detail: string;
  confidence: number;
};

export type RegionNote = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  note: string;
  confidence: number;
};

export type ImageEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};



export function valuesOf(state: unknown): JsonRecord {
  if (R.isPlainObject(state) && R.isPlainObject(state.values)) return state.values;
  return R.isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (key, child) => {
      if ((key === "data_url" || key === "image_data_url") && R.isString(child) && child.startsWith("data:image")) {
        return `[image data URL: ${child.length} chars]`;
      }
      return child;
    },
    2,
  );
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!R.isPlainObject(data)) return [];
  return R.filter(R.values(data), R.isPlainObject);
}

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export function normalizeMetadata(value: unknown): ImageMetadata | null {
  if (!R.isPlainObject(value)) return null;
  return {
    name: R.isString(value.name) ? value.name : "image",
    mimeType: R.isString(value.mime_type) ? value.mime_type : "",
    size: numberValue(value.size),
    width: numberValue(value.width),
    height: numberValue(value.height),
    source: R.isString(value.source) ? value.source : "",
  };
}

export function normalizeObservations(value: unknown): Observation[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((item) => ({
      label: R.isString(item.label) ? item.label : "Observation",
      detail: R.isString(item.detail) ? item.detail : "",
      confidence: numberValue(item.confidence),
    })));
}

export function normalizeRegionNotes(value: unknown): RegionNote[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((item, index) => ({
      id: R.isString(item.id) ? item.id : `region-${index + 1}`,
      label: R.isString(item.label) ? item.label : `Region ${index + 1}`,
      x: numberValue(item.x),
      y: numberValue(item.y),
      width: numberValue(item.width),
      height: numberValue(item.height),
      note: R.isString(item.note) ? item.note : "",
      confidence: numberValue(item.confidence),
    })));
}

export function normalizeImageEvents(value: unknown): ImageEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "26_multimodal_image_input",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function mergeImageEvents(current: ImageEvent[], next: ImageEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}

export function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}
