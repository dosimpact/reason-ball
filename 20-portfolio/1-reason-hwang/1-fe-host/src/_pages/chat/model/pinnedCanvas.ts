export const CANVAS_COLUMNS = 24;
export const CANVAS_ROW_HEIGHT = 28;
export const CANVAS_ROW_GAP = 12;
export type CanvasLayout = { x: number; y: number; w: number; h: number };
export type PinnedCanvasItem = {
  id: string;
  sourceElementId: string;
  title: string;
  program: string;
  messageId: string;
  reportId?: string;
  initialState?: Record<string, unknown>;
  reactiveState?: Record<string, unknown>;
  successfulArgs?: Record<string, unknown>;
  layout: CanvasLayout;
  pinned: boolean;
  addedAt: string;
};
export type CanvasItemSelection = Pick<PinnedCanvasItem, "title" | "program" | "initialState"> & { id: string };
export type CanvasGridLayout = CanvasLayout & { i: string };

// Keep the existing key so an upgrade can discover and migrate every saved canvas.
export function storageKey(runtimeId: string, threadId: string): string {
  return `ta-canvas-items-v1:${runtimeId}:${threadId}`;
}
export function serializePinnedItems(items: PinnedCanvasItem[]): string {
  return JSON.stringify({ version: 2, items });
}
function validLayout(value: unknown): value is CanvasLayout {
  if (!value || typeof value !== "object") return false;
  const { x, y, w, h } = value as CanvasLayout;
  return [x, y, w, h].every(Number.isInteger) && x >= 0 && y >= 0 && y <= 10000 && w >= 4 && w <= 24 && h >= 4 && h <= 40 && x + w <= 24;
}
function overlaps(a: CanvasLayout, b: CanvasLayout): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function arrange(items: PinnedCanvasItem[], preferred?: string): PinnedCanvasItem[] {
  const placed: PinnedCanvasItem[] = [];
  const result = items.map(item => ({ ...item, layout: { ...item.layout } }));
  const ordered = [...result].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.id === preferred) - Number(a.id === preferred));
  for (const item of ordered) {
    while (placed.some(other => overlaps(item.layout, other.layout))) {
      if (item.pinned || item.layout.y >= 10000) return items;
      item.layout.y += 1;
    }
    placed.push(item);
  }
  return result;
}
export function restorePinnedItems(value: string | null): PinnedCanvasItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const legacy = Array.isArray(parsed);
    const entries: unknown[] = legacy ? parsed : parsed?.version === 2 && Array.isArray(parsed.items) ? parsed.items : [];
    const items: PinnedCanvasItem[] = [];
    const ids = new Set<string>();
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as PinnedCanvasItem & { columns?: number; height?: number };
      if (typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.title !== "string" || typeof item.program !== "string" || !item.program || typeof item.messageId !== "string") continue;
      let layout = item.layout;
      if (legacy && !layout) {
        if (![1, 2].includes(item.columns ?? 0) || typeof item.height !== "number" || item.height < 180 || item.height > 1200) continue;
        layout = { x: 0, y: items.reduce((bottom, saved) => Math.max(bottom, saved.layout.y + saved.layout.h), 0), w: item.columns === 2 ? 24 : 12, h: Math.max(4, Math.min(40, Math.ceil((item.height + 12) / 40))) };
      }
      if (!validLayout(layout) || (!legacy && (typeof item.sourceElementId !== "string" || !item.sourceElementId || typeof item.pinned !== "boolean"))) continue;
      ids.add(item.id);
      const { columns: _columns, height: _height, ...saved } = item;
      void _columns; void _height;
      items.push({ ...saved, sourceElementId: item.sourceElementId || item.id, layout, pinned: item.pinned ?? false });
    }
    return arrange(items);
  } catch { return []; }
}
export function pinItem(items: PinnedCanvasItem[], selection: CanvasItemSelection, messageId: string, reportId?: string): PinnedCanvasItem[] {
  const state = selection.initialState ? structuredClone(selection.initialState) : undefined;
  return arrange([...items, {
    ...selection, id: crypto.randomUUID(), sourceElementId: selection.id, messageId, reportId,
    initialState: state, reactiveState: state ? structuredClone(state) : undefined,
    layout: { x: 0, y: 0, w: 12, h: 10 }, pinned: false, addedAt: new Date().toISOString(),
  }]);
}
export function applyLayouts(items: PinnedCanvasItem[], layouts: readonly CanvasGridLayout[]): PinnedCanvasItem[] {
  if (layouts.some(layout => !validLayout(layout))) return items;
  const changed = layouts.find(layout => {
    const item = items.find(entry => entry.id === layout.i);
    return item && !item.pinned && ["x", "y", "w", "h"].some(key => item.layout[key as keyof CanvasLayout] !== layout[key as keyof CanvasLayout]);
  });
  const updated = items.map(item => {
    const layout = layouts.find(entry => entry.i === item.id);
    return layout && !item.pinned ? { ...item, layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h } } : item;
  });
  return arrange(updated, changed?.i);
}
