import * as R from "remeda";
export const defaultRequest =
  "Analyze conversion by channel, identify the strongest segment, and produce a compact chart and retry-safe sandbox log.";

export const defaultCsv = `channel,visitors,signups,revenue
Organic,4200,504,30240
Paid Search,3100,279,19530
Referral,1800,252,17640
Email,2400,384,26880
Partner,950,171,13680`;

export type JsonRecord = Record<string, unknown>;

export type DatasetColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

export type TableCell = string | number | boolean | null;

export type TableRow = Record<string, TableCell>;

export type AnalysisStep = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

export type ChartDatum = {
  label: string;
  value: number;
  color: string;
};

export type ChartSpec = {
  title: string;
  metric: string;
  kind: string;
  data: ChartDatum[];
};

export type AnalysisEvent = {
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

export function normalizeColumns(value: unknown): DatasetColumn[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((column) => ({
      name: R.isString(column.name) ? column.name : "",
      type:
        R.isString(column.type)
          ? column.type
          : R.isString(column.inferred_type)
            ? column.inferred_type
            : "string",
      nullable: Boolean(column.nullable),
    })));
}

export function normalizeRows(value: unknown): TableRow[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((row) => {
      const next: TableRow = {};
      for (const [key, cell] of R.entries(row)) {
        if (R.isString(cell) || typeof cell === "number" || typeof cell === "boolean" || cell === null) {
          next[key] = cell;
        } else {
          next[key] = String(cell);
        }
      }
      return next;
    }));
}

export function normalizeSteps(value: unknown): AnalysisStep[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((step, index) => ({
      id: R.isString(step.id) ? step.id : `step-${index + 1}`,
      label:
        R.isString(step.label)
          ? step.label
          : R.isString(step.title)
            ? step.title
            : R.isString(step.name)
              ? step.name
              : `Step ${index + 1}`,
      status: R.isString(step.status) ? step.status : "pending",
      detail: R.isString(step.detail) ? step.detail : "",
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

export function normalizeChartSpecs(value: unknown): ChartSpec[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((chart) => ({
      title: R.isString(chart.title) ? chart.title : "Analysis chart",
      metric: R.isString(chart.metric) ? chart.metric : R.isString(chart.y) ? chart.y : "value",
      kind: R.isString(chart.kind) ? chart.kind : "bar",
      data: R.isArray(chart.data)
        ? chart.data.filter(R.isPlainObject).map((datum, index) => ({
          label: R.isString(datum.label) ? datum.label : `Row ${index + 1}`,
          value:
            typeof datum.value === "number"
              ? datum.value
              : R.isString(chart.y) && typeof datum[chart.y] === "number"
                ? Number(datum[chart.y])
                : numberValue(datum.value),
          color: R.isString(datum.color) ? datum.color : "#0f766e",
        }))
        : [],
    })));
}

export function rowsFromResultTable(value: unknown): TableRow[] {
  if (R.isPlainObject(value) && R.isArray(value.rows)) return normalizeRows(value.rows);
  return normalizeRows(value);
}

export function normalizeEvents(value: unknown): AnalysisEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "34_chat_data_analysis_canvas",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function mergeEvents(current: AnalysisEvent[], next: AnalysisEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}

export function tableColumns(rows: TableRow[], columns: DatasetColumn[]) {
  const fromSchema = columns.map((column) => column.name).filter(Boolean);
  if (fromSchema.length > 0) return fromSchema;
  return R.keys(rows[0] ?? {});
}
