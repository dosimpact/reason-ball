import type { PinnedCanvasItem } from "./pinnedCanvas";

type GridPosition = PinnedCanvasItem["layout"];

/** Mobile is a display projection and must never replace the saved desktop layout. */
export function displayLayouts(items: PinnedCanvasItem[], narrow: boolean) {
  let y = 0;
  const ordered = narrow ? [...items].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x) : items;
  return ordered.map(item => {
    const layout = narrow ? { ...item.layout, x: 0, y, w: 24 } : item.layout;
    if (narrow) y += item.layout.h;
    return { i: item.id, ...layout, minW: 4, minH: 4, maxH: 40, static: narrow || item.pinned };
  });
}

export function keyboardLayout(layout: GridPosition, key: string, resize: boolean): GridPosition | null {
  const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const delta = directions[key];
  if (!delta) return null;
  if (resize) {
    const w = Math.max(4, Math.min(24, layout.w + delta[0]));
    return { ...layout, w, x: Math.min(layout.x, 24 - w), h: Math.max(4, Math.min(40, layout.h + delta[1])) };
  }
  return { ...layout, x: Math.max(0, Math.min(24 - layout.w, layout.x + delta[0])), y: Math.max(0, Math.min(10000, layout.y + delta[1])) };
}
