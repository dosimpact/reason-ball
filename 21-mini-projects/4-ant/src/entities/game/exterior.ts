import type { GameState, Pixel } from "./types";
export type GridPoint = { x: number; y: number };
const DIRECTIONS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

/** Four-connected flood from below the artwork. Reserved blocks remain solid until pickup. */
function exteriorMap(pixels: Pixel[]) {
  const maxX = Math.max(0, ...pixels.map((p) => p.x));
  const maxY = Math.max(0, ...pixels.map((p) => p.y));
  const width = maxX + 3,
    height = maxY + 3;
  const occupied = new Uint8Array(width * height);
  const previous = new Int32Array(width * height).fill(-1);
  const key = (x: number, y: number) => (y + 1) * width + x + 1;
  for (const p of pixels)
    if (p.status === "present" || p.status === "reserved")
      occupied[key(p.x, p.y)] = 1;
  const entry = { x: Math.floor(maxX / 2), y: maxY + 1 };
  const start = key(entry.x, entry.y);
  const queue = new Int32Array(width * height);
  let head = 0,
    tail = 1;
  queue[0] = start;
  previous[start] = start;
  while (head < tail) {
    const current = queue[head++],
      x = current % width,
      y = Math.floor(current / width);
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (occupied[next] || previous[next] !== -1) continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  return { width, height, key, previous, start };
}

export function exposedIds(state: Pick<GameState, "pixels">): number[] {
  if (!state.pixels.length) return [];
  const map = exteriorMap(state.pixels);
  return state.pixels
    .filter(
      (p) =>
        p.status === "present" &&
        DIRECTIONS.some(
          ([dx, dy]) => map.previous[map.key(p.x + dx, p.y + dy)] >= 0,
        ),
    )
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((p) => p.id);
}

/** Shortest walk on exterior empty cells, ending at the target block. Every step is orthogonal. */
export function collectionPath(
  state: Pick<GameState, "pixels">,
  targetId: number,
): GridPoint[] {
  const target = state.pixels.find((p) => p.id === targetId);
  if (!target) return [];
  const map = exteriorMap(state.pixels);
  let best: GridPoint[] = [];
  for (const [dx, dy] of DIRECTIONS) {
    let current = map.key(target.x + dx, target.y + dy);
    if (map.previous[current] < 0) continue;
    const path: GridPoint[] = [{ x: target.x, y: target.y }];
    while (true) {
      path.push({
        x: (current % map.width) - 1,
        y: Math.floor(current / map.width) - 1,
      });
      if (current === map.start) break;
      current = map.previous[current];
    }
    path.reverse();
    if (!best.length || path.length < best.length) best = path;
  }
  return best;
}
