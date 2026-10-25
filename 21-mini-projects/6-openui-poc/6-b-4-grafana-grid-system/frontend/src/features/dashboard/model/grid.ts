import type { Panel, GridLayout } from "@/entities/dashboard";

/** Narrow views are a projection; never write these coordinates to storage. */
export function displayLayouts(panels: Panel[], narrow: boolean) {
  let y = 0;
  const ordered = narrow
    ? [...panels].sort(
        (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
      )
    : panels;
  return ordered.map((panel) => {
    const layout = narrow ? { ...panel.layout, x: 0, y, w: 24 } : panel.layout;
    if (narrow) y += panel.layout.h;
    return { i: panel.id, ...layout, static: narrow || panel.pinned };
  });
}
export function keyboardLayout(
  layout: GridLayout,
  key: string,
  resize: boolean,
): GridLayout | null {
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const delta = directions[key];
  if (!delta) return null;
  if (resize) {
    const w = Math.max(4, Math.min(24, layout.w + delta[0]));
    return {
      ...layout,
      w,
      x: Math.min(layout.x, 24 - w),
      h: Math.max(4, Math.min(40, layout.h + delta[1])),
    };
  }
  return {
    ...layout,
    x: Math.max(0, Math.min(24 - layout.w, layout.x + delta[0])),
    y: Math.max(0, Math.min(10000, layout.y + delta[1])),
  };
}

/** RGL cells include a 12px gutter; convert against the actual grid bounds. */
export function dropPosition(left: number, top: number, width: number) {
  return {
    x: Math.max(0, Math.min(23, Math.floor(left / ((width + 12) / 24)))),
    y: Math.max(0, Math.min(10000, Math.floor(top / 40))),
  };
}
