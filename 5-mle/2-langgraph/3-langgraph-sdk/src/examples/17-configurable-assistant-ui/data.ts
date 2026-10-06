import * as R from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const samples = [
  {
    label: "SDK Config",
    value:
      "Explain why LangGraph runtime configuration is useful for SDK learners.",
  },
  {
    label: "Assistant Tone",
    value:
      "Describe how changing a system prompt affects an assistant without changing graph code.",
  },
  {
    label: "Run Override",
    value:
      "Summarize why run-level config overrides are useful for testing product behavior.",
  },
];

export const styleOptions = [
  { label: "Concise", value: "concise" },
  { label: "Detailed", value: "detailed" },
  { label: "Playful", value: "playful" },
  { label: "Strict", value: "strict" },
] as const;

export const modelOptions = ["fast", "default", "normal", "smart"] as const;

export type Style = (typeof styleOptions)[number]["value"];

export type ModelAlias = (typeof modelOptions)[number];

export type JsonRecord = Record<string, unknown>;

export type EffectiveConfig = {
  model: string;
  resolvedModel: string;
  systemPrompt: string;
  style: string;
  temperature: number;
  styleHint: string;
};

export type ConfigEvent = {
  type: string;
  runLabel: string;
  model: string;
  style: string;
  temperature: number;
  detail: string;
};

export type RunResult = {
  label: string;
  threadId: string;
  response: string;
  summary: string;
  effectiveConfig: EffectiveConfig | null;
  finalState: JsonRecord | null;
};



export function valuesOf(state: unknown): JsonRecord {
  if (R.isPlainObject(state) && R.isPlainObject(state.values)) return state.values;
  return R.isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!R.isPlainObject(data)) return [];
  return R.filter(R.values(data), R.isPlainObject);
}

export function normalizeEffectiveConfig(
  value: unknown,
): EffectiveConfig | null {
  if (!R.isPlainObject(value)) return null;
  return {
    model: R.isString(value.model) ? value.model : "",
    resolvedModel:
      R.isString(value.resolved_model) ? value.resolved_model : "",
    systemPrompt:
      R.isString(value.system_prompt) ? value.system_prompt : "",
    style: R.isString(value.style) ? value.style : "",
    temperature: typeof value.temperature === "number" ? value.temperature : 0,
    styleHint: R.isString(value.style_hint) ? value.style_hint : "",
  };
}

export function normalizeConfigEvents(value: unknown): ConfigEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "config_applied",
      runLabel:
        R.isString(event.run_label)
          ? event.run_label
          : String(event.runLabel ?? "run"),
      model: R.isString(event.model) ? event.model : "",
      style: R.isString(event.style) ? event.style : "",
      temperature: typeof event.temperature === "number" ? event.temperature : 0,
      detail: R.isString(event.detail) ? event.detail : "",
    })));
}

export function mergeConfigEvents(current: ConfigEvent[], next: ConfigEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.runLabel}:${event.model}:${event.style}:${event.temperature}:${event.detail}`)
    .slice(-30);
}

export function runFromValues(
  label: string,
  threadId: string,
  values: JsonRecord,
): RunResult {
  return {
    label,
    threadId,
    response: R.isString(values.response) ? values.response : "",
    summary:
      R.isString(values.response_summary)
        ? values.response_summary
        : "",
    effectiveConfig: normalizeEffectiveConfig(values.effective_config),
    finalState: values,
  };
}

export function configRows(
  defaultRun: RunResult | null,
  overrideRun: RunResult | null,
) {
  const left = defaultRun?.effectiveConfig;
  const right = overrideRun?.effectiveConfig;
  return [
    ["Model", left?.model ?? "pending", right?.model ?? "pending"],
    [
      "Resolved model",
      left?.resolvedModel ?? "pending",
      right?.resolvedModel ?? "pending",
    ],
    ["Style", left?.style ?? "pending", right?.style ?? "pending"],
    [
      "Temperature",
      String(left?.temperature ?? "pending"),
      String(right?.temperature ?? "pending"),
    ],
    [
      "System prompt",
      left?.systemPrompt ?? "pending",
      right?.systemPrompt ?? "pending",
    ],
  ];
}
