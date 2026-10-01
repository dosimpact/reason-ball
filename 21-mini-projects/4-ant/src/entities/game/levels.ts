import type { Box, Difficulty, GameState, Pixel } from "./types";
import { stageArtwork } from "./artworks";
import { exposedIds } from "./exterior";

function buildQueues(
  pixels: Pixel[],
  level: number,
  difficulty: Difficulty,
): { queues: Box[][]; solution: number[] } {
  const remaining = pixels.map((pixel) => ({ ...pixel }));
  const queues: Box[][] = [[], [], []];
  const solution: number[] = [];
  let boxId = 0;
  while (remaining.some((pixel) => pixel.status === "present")) {
    const exposed = exposedIds({ pixels: remaining }).map(
      (id) => remaining[id],
    );
    const color = exposed[(boxId + level) % exposed.length].color;
    const targets = exposed
      .filter((pixel) => pixel.color === color)
      .slice(
        0,
        { easy: 20, normal: 14, hard: 8 }[difficulty] -
          Math.floor((level - 1) / 40),
      );
    const lane = boxId % 3;
    queues[lane].push({
      id: boxId++,
      color,
      count: targets.length,
      collected: 0,
      pending: 0,
    });
    solution.push(lane);
    for (const pixel of targets) pixel.status = "deposited";
  }
  return { queues, solution };
}

export function createGame(level: number, difficulty: Difficulty): GameState {
  if (!Number.isInteger(level) || level < 1 || level > 100)
    throw new RangeError("Level must be an integer from 1 to 100");
  if (!["easy", "normal", "hard"].includes(difficulty))
    throw new RangeError("Unknown difficulty");
  const artwork = stageArtwork(level);
  const pixels = artwork.pixels;
  return {
    level,
    difficulty,
    width: artwork.width,
    height: artwork.height,
    motif: artwork.name,
    pixels,
    ...buildQueues(pixels, level, difficulty),
    ants: [],
    slots: Array.from({ length: 5 }, () => null),
    status: "playing",
    elapsedMs: 0,
    timeLimitMs:
      { easy: 180000, normal: 140000, hard: 100000 }[difficulty] +
      pixels.length * 850 -
      (level - 1) * 150,
    collected: 0,
    total: pixels.length,
    nextAntId: 0,
    lossReason: null,
  };
}
