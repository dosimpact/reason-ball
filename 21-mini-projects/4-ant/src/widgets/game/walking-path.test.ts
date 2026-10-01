import { expect, it } from "vitest";
import { catPaths, walkingPath, walkPosition } from "./walking-path";
it("walks an L path by distance without cutting the corner", () => {
  const path = walkingPath([
    { x: 0, y: 10 },
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ]);
  expect(walkPosition(path, 1 / 6)).toMatchObject({ x: 0, y: 5 });
  expect(walkPosition(path, 2 / 3)).toMatchObject({ x: 10, y: 0 });
  expect(walkPosition(path, 1)).toMatchObject({ x: 20, y: 0 });
});
it("joins the lower dock and home with orthogonal segments and bypasses the hole outbound", () => {
  for (let slot = 0; slot < 5; slot++) {
    const routes = catPaths(
      [
        { x: 4, y: 6 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      slot,
      { cell: 10, ox: 5, oy: 5 },
      100,
      100,
    );
    for (const path of Object.values(routes))
      for (let i = 1; i < path.points.length; i++) {
        expect(
          path.points[i].x === path.points[i - 1].x ||
            path.points[i].y === path.points[i - 1].y,
        ).toBe(true);
      }
    expect(routes.outbound.points[0].y).toBe(100);
    expect(routes.returning.points.at(-1)).toEqual({ x: 50, y: 88.5 });
  }
});
