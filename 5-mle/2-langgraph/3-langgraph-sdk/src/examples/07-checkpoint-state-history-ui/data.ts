import { isPlainObject, isArray, isString, unique } from "remeda";
export const defaultTopic =
  "debugging LangGraph state changes with checkpoints";

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
  parent_checkpoint?: ThreadCheckpoint | null;
  next?: string[];
  tasks?: unknown[];
};

export type HistoryEntry = {
  id: string;
  label: string;
  values: JsonRecord;
  checkpoint: ThreadCheckpoint | null;
  metadata: JsonRecord | null;
  createdAt: string;
  next: string[];
  writes: string[];
};

type DiffStatus =
  "added in current" | "removed from current" | "changed" | "same";

type DiffRow = {
  key: string;
  status: DiffStatus;
  selected: string;
  current: string;
};

export function valuesOf(value: unknown): JsonRecord {
  if (isPlainObject(value) && isPlainObject(value.values)) return value.values;
  return isPlainObject(value) ? value : {};
}

export function checkpointId(
  checkpoint: ThreadCheckpoint | null | undefined,
  fallback: string,
) {
  return checkpoint?.checkpoint_id ?? checkpoint?.checkpointId ?? fallback;
}

export function metadataSource(metadata: JsonRecord | null): string {
  return isString(metadata?.source) ? metadata.source : "history";
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
    const metadata = isPlainObject(record.metadata) ? record.metadata : null;
    const writes = isPlainObject(metadata?.writes)
      ? Object.keys(metadata.writes)
      : [];
    const checkpoint = record.checkpoint ?? null;
    const id = checkpointId(checkpoint, `checkpoint-${index + 1}`);
    return {
      id,
      label: `Checkpoint ${index + 1}`,
      values: valuesOf(record.values),
      checkpoint,
      metadata,
      createdAt: record.created_at ?? "",
      next: isArray(record.next) ? record.next : [],
      writes,
    };
  });
}

export function buildDiff(
  selected: JsonRecord,
  current: JsonRecord,
): DiffRow[] {
  const keys = unique([...Object.keys(selected), ...Object.keys(current)]).sort();
  return keys.map((key) => {
    const selectedValue = selected[key];
    const currentValue = current[key];
    const selectedText = formatValue(selectedValue);
    const currentText = formatValue(currentValue);
    let status: DiffStatus = "same";
    if (!(key in selected)) status = "added in current";
    else if (!(key in current)) status = "removed from current";
    else if (selectedText !== currentText) status = "changed";
    return { key, status, selected: selectedText, current: currentText };
  });
}
