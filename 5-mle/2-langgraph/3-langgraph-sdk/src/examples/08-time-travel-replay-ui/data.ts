import { isPlainObject, isArray, isString, isNumber, unique } from "remeda";
export const defaultTopic = "debugging replay branches from checkpoint history";

export const defaultReplayTopic =
  "forked replay branch with stricter rollback guidance";

export const defaultReplayInstruction =
  "Emphasize how the fork changed the outcome while preserving the original checkpoint.";

export type JsonRecord = Record<string, unknown>;

type ThreadCheckpoint = {
  checkpoint_id?: string;
  checkpointId?: string;
  checkpoint_ns?: string;
  checkpointNs?: string;
  thread_id?: string;
  threadId?: string;
};

type ThreadStateRecord = {
  values?: unknown;
  checkpoint?: ThreadCheckpoint | null;
  metadata?: JsonRecord | null;
  created_at?: string | null;
  next?: string[];
};

export type HistoryEntry = {
  id: string;
  label: string;
  values: JsonRecord;
  checkpoint: ThreadCheckpoint | null;
  metadata: JsonRecord | null;
  createdAt: string;
  next: string[];
  stage: string;
  step: string;
};

type ComparisonRow = {
  key: string;
  original: string;
  replay: string;
  status: "changed" | "same" | "added in replay" | "removed in replay";
};

export function valuesOf(value: unknown): JsonRecord {
  if (isPlainObject(value) && isPlainObject(value.values)) return value.values;
  return isPlainObject(value) ? value : {};
}

function checkpointId(
  checkpoint: ThreadCheckpoint | null | undefined,
  fallback: string,
) {
  return checkpoint?.checkpoint_id ?? checkpoint?.checkpointId ?? fallback;
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatValue(value: unknown): string {
  return value === undefined ? "undefined" : formatJson(value);
}

export function normalizeHistory(history: unknown): HistoryEntry[] {
  if (!isArray(history)) return [];
  return history.map((item, index) => {
    const record = isPlainObject(item)
      ? (item as ThreadStateRecord)
      : ({} as ThreadStateRecord);
    const values = valuesOf(record.values);
    const metadata = isPlainObject(record.metadata) ? record.metadata : null;
    const checkpoint = record.checkpoint ?? null;
    const id = checkpointId(checkpoint, `checkpoint-${index + 1}`);
    return {
      id,
      label: `Checkpoint ${index + 1}`,
      values,
      checkpoint,
      metadata,
      createdAt: record.created_at ?? "",
      next: isArray(record.next) ? record.next : [],
      stage: isString(values.stage) ? values.stage : "unknown",
      step:
        isNumber(metadata?.step)
          ? `step ${metadata.step}`
          : "step unknown",
    };
  });
}

export function replayCandidate(history: HistoryEntry[]): HistoryEntry | null {
  return (
    history.find((entry) => entry.stage === "drafted") ??
    history.find((entry) => entry.stage === "prepared") ??
    history[1] ??
    history[0] ??
    null
  );
}

export function buildComparison(
  original: JsonRecord | null,
  replay: JsonRecord | null,
): ComparisonRow[] {
  if (!original || !replay) return [];
  const keys = unique([...Object.keys(original), ...Object.keys(replay)]).sort();
  return keys.map((key) => {
    const originalText = formatValue(original[key]);
    const replayText = formatValue(replay[key]);
    let status: ComparisonRow["status"] = "same";
    if (!(key in original)) status = "added in replay";
    else if (!(key in replay)) status = "removed in replay";
    else if (originalText !== replayText) status = "changed";
    return { key, original: originalText, replay: replayText, status };
  });
}
