import { describe, it, expect } from "vitest";
import { collectionPath, exposedIds } from "./exterior";
import { stageArtwork } from "./artworks";
import type { Pixel } from "./types";
function grid(rows: string[]) {
  const pixels: Pixel[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((value, x) => {
      if (value !== ".")
        pixels.push({
          id: pixels.length,
          x,
          y,
          color: "ink",
          status: "present",
        });
    }),
  );
  return { pixels };
}
describe("outside-in peeling", () => {
  it("exposes all four outside edges, never the enclosed center", () => {
    const state = grid(["XXX", "XXX", "XXX"]);
    expect(exposedIds(state)).toEqual([6, 7, 8, 3, 5, 0, 1, 2]);
    state.pixels[7].status = "reserved";
    expect(exposedIds(state)).not.toContain(4);
    state.pixels[7].status = "carried";
    expect(exposedIds(state)).toContain(4);
  });
  it("does not enter a sealed cavity or a diagonal-only opening", () => {
    const state = grid([
      "XXXXXXX",
      "X.....X",
      "X.XXX.X",
      "X.XXX.X",
      "X.XXX.X",
      "X.....X",
      "XXXXXXX",
    ]);
    const middle = state.pixels.find((p) => p.x === 2 && p.y === 2)!;
    expect(exposedIds(state)).not.toContain(middle.id);
    state.pixels[0].status = "deposited";
    expect(exposedIds(state)).not.toContain(middle.id);
    state.pixels[1].status = "deposited";
    expect(exposedIds(state)).toContain(middle.id);
  });
  it("walks from below around obstacles using only orthogonal empty cells", () => {
    const state = grid(["XXXXX", "XXXXX", "XXXXX"]);
    const route = collectionPath(state, 2);
    expect(route[0].y).toBeGreaterThan(2);
    expect(route.at(-1)).toEqual({ x: 2, y: 0 });
    const solid = new Set(state.pixels.map((p) => `${p.x},${p.y}`));
    route
      .slice(0, -1)
      .forEach((p) => expect(solid.has(`${p.x},${p.y}`)).toBe(false));
    for (let i = 1; i < route.length; i++)
      expect(
        Math.abs(route[i].x - route[i - 1].x) +
          Math.abs(route[i].y - route[i - 1].y),
      ).toBe(1);
    expect(collectionPath(state, 7)).toEqual([]);
  });
  it("supplies 100 unique named artwork maps with facial/ingredient colors", () => {
    const maps = Array.from({ length: 100 }, (_, i) => stageArtwork(i + 1));
    expect(new Set(maps.map((a) => a.name)).size).toBe(100);
    expect(new Set(maps.map((a) => JSON.stringify(a.pixels))).size).toBe(100);
    expect(maps[10].name).toContain("김밥");
    for (const artwork of maps) {
      expect(artwork.pixels.length).toBeGreaterThan(80);
      expect(artwork.pixels.some((p) => p.color === "ink")).toBe(true);
      expect(
        new Set(artwork.pixels.map((p) => p.color)).size,
      ).toBeGreaterThanOrEqual(3);
      expect(artwork.width).toBeLessThanOrEqual(26);
    }
  });
});

it("the browser loss fixture reaches a genuine blocked state", async () => {
  const { createGame, deployBox, tickGame } = await import("./index");
  let state = createGame(6, "hard");
  for (const lane of [1, 1, 1, 1, 1])
    state = tickGame(deployBox(state, lane), 1000);
  expect(state.lossReason).toBe("blocked");
});
