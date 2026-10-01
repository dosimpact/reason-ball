import type { GridPoint } from "../../entities/game";
export type WalkPath = {
  points: GridPoint[];
  distances: number[];
  length: number;
};
export function walkingPath(points: GridPoint[]): WalkPath {
  const distances = [0];
  for (let i = 1; i < points.length; i++)
    distances.push(
      distances[i - 1] +
        Math.abs(points[i].x - points[i - 1].x) +
        Math.abs(points[i].y - points[i - 1].y),
    );
  return { points, distances, length: distances.at(-1) ?? 0 };
}
/** Interpolate by distance, never diagonally across a corner. */
export function walkPosition(path: WalkPath, progress: number) {
  const distance = Math.max(0, Math.min(1, progress)) * path.length;
  for (let i = 1; i < path.points.length; i++) {
    if (
      path.distances[i] < distance ||
      path.distances[i] === path.distances[i - 1]
    )
      continue;
    const from = path.points[i - 1],
      to = path.points[i];
    const fraction =
      (distance - path.distances[i - 1]) /
      (path.distances[i] - path.distances[i - 1]);
    return {
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
      direction: Math.sign(to.x - from.x),
    };
  }
  return { ...(path.points.at(-1) ?? { x: 0, y: 0 }), direction: 0 };
}
export function catPaths(
  route: GridPoint[],
  slot: number,
  layout: { cell: number; ox: number; oy: number },
  width: number,
  height: number,
  dpr = 1,
) {
  const cells = route.map((p) => ({
    x: layout.ox + (p.x + 0.5) * layout.cell,
    y: layout.oy + (p.y + 0.5) * layout.cell,
  }));
  const entry = cells[0];
  const aisleY = Math.max(height * 0.79, entry.y);
  const slotX = width * (0.1 + 0.2 * slot);
  const approachX =
    slot === 2 ? Math.min(width * 0.9, width / 2 + 35 * dpr) : slotX;
  const front = [
    { x: slotX, y: height },
    { x: approachX, y: height },
    { x: approachX, y: aisleY },
    { x: entry.x, y: aisleY },
  ];
  const home = [
    { x: entry.x, y: aisleY },
    { x: width / 2, y: aisleY },
    { x: width / 2, y: height * 0.885 },
  ];
  return {
    outbound: walkingPath([...front, ...cells]),
    returning: walkingPath([...cells].reverse().concat(home)),
  };
}
