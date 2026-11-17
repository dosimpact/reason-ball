export type PinnedCanvasItem = {
  id: string;
  title: string;
  program: string;
  messageId: string;
  reportId?: string;
  initialState?: Record<string, unknown>;
  reactiveState?: Record<string, unknown>;
  successfulArgs?: Record<string, unknown>;
  columns: 1 | 2;
  height: number;
  addedAt: string;
};

export type CanvasItemSelection = Pick<PinnedCanvasItem, "id" | "title" | "program" | "initialState">;

const prefix = "ta-canvas-items-v1:";

export function storageKey(runtimeId: string, threadId: string): string {
  return `${prefix}${runtimeId}:${threadId}`;
}

export function restorePinnedItems(value: string | null): PinnedCanvasItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<string>();
    return parsed.filter((item): item is PinnedCanvasItem => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Partial<PinnedCanvasItem>;
      if (typeof entry.id !== "string" || !entry.id || ids.has(entry.id) ||
          typeof entry.title !== "string" || typeof entry.program !== "string" || !entry.program ||
          typeof entry.messageId !== "string" || ![1, 2].includes(entry.columns ?? 0) ||
          typeof entry.height !== "number" || entry.height < 180 || entry.height > 1200) return false;
      ids.add(entry.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function pinItem(items: PinnedCanvasItem[], selection: CanvasItemSelection, messageId: string, reportId?: string): PinnedCanvasItem[] {
  if (items.some(item => item.id === selection.id)) return items;
  return [...items, {
    ...selection,
    messageId,
    reportId,
    columns: 1,
    height: 380,
    addedAt: new Date().toISOString(),
  }];
}

export function moveItem(items: PinnedCanvasItem[], sourceId: string, targetId: string): PinnedCanvasItem[] {
  const from = items.findIndex(item => item.id === sourceId);
  const to = items.findIndex(item => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const moved = [...items];
  moved.splice(to, 0, moved.splice(from, 1)[0]);
  return moved;
}
