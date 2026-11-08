import * as R from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const seedMessages = [
  "My name is Dogyung.",
  "Project codename is cobalt.",
  "My pet is a cat named Moka.",
  "I work from Seoul.",
  "I prefer concise examples.",
  "I need stream events separated from message history.",
  "Keep checkpoint IDs visible in the UI.",
  "I am testing long context compaction.",
  "Screenshots must show summary and recent messages.",
  "Now answer with one sentence that you are ready to compact older context.",
];

export type JsonRecord = Record<string, unknown>;

export type MessageDigest = {
  id: string;
  role: string;
  content: string;
  index: number;
};

export type SummaryMetadata = {
  compactionId: string;
  createdAt: string;
  sourceMessageRange: string;
  sourceCount: number;
  retainedCount: number;
  retainedMessageIds: string[];
  removedMessageIds: string[];
  summaryChars: number;
};

export type SummaryRecord = {
  compactionId: string;
  createdAt: string;
  sourceMessageRange: string;
  sourceCount: number;
  retainedCount: number;
  summary: string;
  removedMessages: MessageDigest[];
  retainedMessageIds: string[];
};

export type ContextStats = {
  summarizeAfter: number;
  keepRecent: number;
  totalMessages: number;
  retainedMessageCount: number;
  summarizedMessageCount: number;
  summaryRecordCount: number;
  compactionTriggered: boolean;
};

export type ContextEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  compactionId: string;
  messageCount: number;
  retainedCount: number;
  removedCount: number;
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

function stringList(value: unknown) {
  return R.isArray(value) ? value.map(String) : [];
}

function normalizeDigest(value: unknown, fallbackIndex = 0): MessageDigest {
  const record = R.isPlainObject(value) ? value : {};
  return {
    id:
      R.isString(record.id)
        ? record.id
        : `message-${fallbackIndex + 1}`,
    role: R.isString(record.role) ? record.role : "unknown",
    content: R.isString(record.content) ? record.content : "",
    index: typeof record.index === "number" ? record.index : fallbackIndex + 1,
  };
}

export function normalizeDigests(value: unknown): MessageDigest[] {
  return R.isArray(value)
    ? value.map((item, index) => normalizeDigest(item, index))
    : [];
}

export function normalizeMetadata(value: unknown): SummaryMetadata | null {
  if (!R.isPlainObject(value)) return null;
  return {
    compactionId:
      R.isString(value.compaction_id) ? value.compaction_id : "",
    createdAt: R.isString(value.created_at) ? value.created_at : "",
    sourceMessageRange:
      R.isString(value.source_message_range)
        ? value.source_message_range
        : "",
    sourceCount:
      typeof value.source_count === "number" ? value.source_count : 0,
    retainedCount:
      typeof value.retained_count === "number" ? value.retained_count : 0,
    retainedMessageIds: stringList(value.retained_message_ids),
    removedMessageIds: stringList(value.removed_message_ids),
    summaryChars:
      typeof value.summary_chars === "number" ? value.summary_chars : 0,
  };
}

export function normalizeSummaryRecords(value: unknown): SummaryRecord[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((record) => ({
      compactionId:
        R.isString(record.compaction_id) ? record.compaction_id : "",
      createdAt: R.isString(record.created_at) ? record.created_at : "",
      sourceMessageRange:
        R.isString(record.source_message_range)
          ? record.source_message_range
          : "",
      sourceCount:
        typeof record.source_count === "number" ? record.source_count : 0,
      retainedCount:
        typeof record.retained_count === "number" ? record.retained_count : 0,
      summary: R.isString(record.summary) ? record.summary : "",
      removedMessages: normalizeDigests(record.removed_messages),
      retainedMessageIds: stringList(record.retained_message_ids),
    })));
}

export function normalizeContextStats(value: unknown): ContextStats {
  const record = R.isPlainObject(value) ? value : {};
  return {
    summarizeAfter:
      typeof record.summarize_after === "number" ? record.summarize_after : 8,
    keepRecent: typeof record.keep_recent === "number" ? record.keep_recent : 4,
    totalMessages:
      typeof record.total_messages === "number" ? record.total_messages : 0,
    retainedMessageCount:
      typeof record.retained_message_count === "number"
        ? record.retained_message_count
        : 0,
    summarizedMessageCount:
      typeof record.summarized_message_count === "number"
        ? record.summarized_message_count
        : 0,
    summaryRecordCount:
      typeof record.summary_record_count === "number"
        ? record.summary_record_count
        : 0,
    compactionTriggered:
      typeof record.compaction_triggered === "boolean"
        ? record.compaction_triggered
        : false,
  };
}

export function normalizeContextEvents(value: unknown): ContextEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "context_status",
      phase: R.isString(event.phase) ? event.phase : "event",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      compactionId:
        R.isString(event.compaction_id)
          ? event.compaction_id
          : String(event.compactionId ?? ""),
      messageCount:
        typeof event.message_count === "number" ? event.message_count : 0,
      retainedCount:
        typeof event.retained_count === "number" ? event.retained_count : 0,
      removedCount:
        typeof event.removed_count === "number" ? event.removed_count : 0,
    })));
}

export function mergeEvents(current: ContextEvent[], next: ContextEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.compactionId}:${event.detail}`)
    .slice(-80);
}
