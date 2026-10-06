import * as R from "remeda";
export const defaultRequest =
  "Create a compact launch status card with clear success metrics, a review badge, and one primary action.";

export type JsonRecord = Record<string, unknown>;

export type TreeEntry = {
  id: string;
  name: string;
  role: string;
  detail: string;
};

export type StyleControl = {
  id: string;
  label: string;
  value: string;
};

export type ApprovalLog = {
  action: string;
  detail: string;
};

export type PreviewVersion = {
  version: number;
  componentName: string;
  summary: string;
};

export type PreviewEvent = {
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
  return JSON.stringify(value, null, 2);
}

export function normalizeTree(value: unknown): TreeEntry[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((entry, index) => ({
      id: R.isString(entry.id) ? entry.id : `node-${index + 1}`,
      name: R.isString(entry.name) ? entry.name : R.isString(entry.label) ? entry.label : `Node ${index + 1}`,
      role: R.isString(entry.role) ? entry.role : R.isString(entry.type) ? entry.type : "component",
      detail: R.isString(entry.detail) ? entry.detail : R.isString(entry.summary) ? entry.summary : "",
    })));
}

export function normalizeControls(value: unknown): StyleControl[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((control, index) => ({
      id: R.isString(control.id) ? control.id : `control-${index + 1}`,
      label: R.isString(control.label) ? control.label : R.isString(control.name) ? control.name : `Control ${index + 1}`,
      value: R.isString(control.value) ? control.value : String(control.value ?? ""),
    })));
}

export function normalizeStrings(value: unknown): string[] {
  if (!R.isArray(value)) return [];
  return value.map((entry) => {
    if (R.isString(entry)) return entry;
    if (R.isPlainObject(entry)) return R.values(entry).map(String).join(" ");
    return String(entry);
  });
}

export function normalizeApprovalLog(value: unknown): ApprovalLog[] {
  if (!R.isArray(value)) return [];
  return value.map((entry) => {
    if (R.isString(entry)) return { action: entry, detail: entry };
    if (R.isPlainObject(entry)) {
      return {
        action:
          R.isString(entry.action)
            ? entry.action
            : R.isString(entry.approval)
              ? entry.approval
              : "",
        detail: R.isString(entry.detail) ? entry.detail : R.isString(entry.reason) ? entry.reason : "",
      };
    }
    return {
      action: String(entry),
      detail: String(entry),
    };
  });
}

export function normalizeVersions(value: unknown): PreviewVersion[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((version) => ({
      version: numberValue(version.version),
      componentName:
        R.isString(version.component_name)
          ? version.component_name
          : R.isString(version.componentName)
            ? version.componentName
            : "",
      summary: R.isString(version.summary) ? version.summary : "",
    })));
}

export function normalizePreviewEvents(value: unknown): PreviewEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "33_chat_ui_preview",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function mergePreviewEvents(current: PreviewEvent[], next: PreviewEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}

export function previewDocument(markup: string) {
  const body = markup || "<p>No preview yet.</p>";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; background: #f5f8f7; color: #21302b; display: grid; place-items: center; padding: 18px; box-sizing: border-box; }
      * { box-sizing: border-box; }
      .preview-card { width: min(100%, 520px); border: 1px solid #bfd8d0; border-radius: 14px; background: #ffffff; box-shadow: 0 18px 50px rgba(30, 58, 50, 0.14); padding: 24px; }
      .preview-card__eyebrow { margin: 0 0 8px; color: #0f766e; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
      .preview-card h2 { margin: 0 0 10px; font-size: 26px; line-height: 1.1; }
      .preview-card p { margin: 0; color: #4d615b; line-height: 1.45; }
      .preview-card__metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 22px 0; }
      .preview-card__metric { border: 1px solid #dce8e4; border-radius: 10px; background: #f4fbf8; padding: 12px; }
      .preview-card__metric span { display: block; color: #0f3f36; font-size: 22px; font-weight: 800; }
      .preview-card__metric small { color: #60756f; font-size: 12px; font-weight: 700; }
      .preview-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #e2ebe7; padding-top: 16px; color: #60756f; font-size: 13px; }
      .preview-card button { border: 0; border-radius: 8px; background: #0f766e; color: white; font-weight: 800; padding: 10px 14px; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}
