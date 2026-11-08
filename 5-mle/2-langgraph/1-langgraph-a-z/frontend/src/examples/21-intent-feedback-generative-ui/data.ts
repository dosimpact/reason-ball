import * as R from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const ambiguousRequest = "Show me Apple stock.";

export const completeRequest = "Show me AAPL on NASDAQ for 1M.";

export type JsonRecord = Record<string, unknown>;

export type FieldName = "ticker" | "market" | "period";

type Option = {
  label: string;
  value: string;
  description: string;
};

export type UIRequest = {
  id: string;
  type: string;
  field: FieldName;
  title: string;
  description: string;
  required: boolean;
  options: Option[];
};

export type IntentRecord = {
  userQuery: string;
  ticker: string;
  market: string;
  period: string;
  confidence: number;
  source: string;
};

export type QuoteSnapshot = {
  ticker: string;
  company: string;
  market: string;
  period: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  asOf: string;
  source: string;
};

export type IntentEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  field: string;
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

function normalizeOption(value: unknown): Option {
  const record = R.isPlainObject(value) ? value : {};
  return {
    label:
      R.isString(record.label)
        ? record.label
        : String(record.value ?? ""),
    value:
      R.isString(record.value)
        ? record.value
        : String(record.label ?? ""),
    description:
      R.isString(record.description) ? record.description : "",
  };
}

export function normalizeUiRequests(value: unknown): UIRequest[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.flatMap((request) => {
      const field = request.field;
      if (field !== "ticker" && field !== "market" && field !== "period")
        return [];
      return [
        {
          id: R.isString(request.id) ? request.id : `${field}-selector`,
          type:
            R.isString(request.type) ? request.type : `${field}_selector`,
          field,
          title:
            R.isString(request.title) ? request.title : `Choose ${field}`,
          description:
            R.isString(request.description) ? request.description : "",
          required:
            typeof request.required === "boolean" ? request.required : true,
          options: R.isArray(request.options)
            ? request.options.map(normalizeOption)
            : [],
        },
      ];
    }));
}

export function normalizeIntent(value: unknown): IntentRecord | null {
  if (!R.isPlainObject(value)) return null;
  return {
    userQuery: R.isString(value.user_query) ? value.user_query : "",
    ticker: R.isString(value.ticker) ? value.ticker : "",
    market: R.isString(value.market) ? value.market : "",
    period: R.isString(value.period) ? value.period : "",
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    source: R.isString(value.source) ? value.source : "",
  };
}

export function normalizeQuote(value: unknown): QuoteSnapshot | null {
  if (!R.isPlainObject(value)) return null;
  return {
    ticker: R.isString(value.ticker) ? value.ticker : "",
    company: R.isString(value.company) ? value.company : "",
    market: R.isString(value.market) ? value.market : "",
    period: R.isString(value.period) ? value.period : "",
    currency: R.isString(value.currency) ? value.currency : "",
    price: typeof value.price === "number" ? value.price : 0,
    change: typeof value.change === "number" ? value.change : 0,
    changePercent:
      typeof value.change_percent === "number" ? value.change_percent : 0,
    asOf: R.isString(value.as_of) ? value.as_of : "",
    source: R.isString(value.source) ? value.source : "",
  };
}

export function normalizeEvents(value: unknown): IntentEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "intent_feedback",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      field: R.isString(event.field) ? event.field : "",
    })));
}

export function mergeIntentEvents(current: IntentEvent[], next: IntentEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.field}`)
    .slice(-80);
}

export function missingFields(value: unknown): FieldName[] {
  if (!R.isArray(value)) return [];
  return value.filter(
    (field): field is FieldName =>
      field === "ticker" || field === "market" || field === "period",
  );
}
