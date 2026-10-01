import { describe, expect, it } from "vitest";
import {
  createGame,
  deployBox,
  exposedIds,
  getHintLane,
  MAX_ACTIVE_ANTS,
  PALETTE,
  tickGame,
} from "./index";
import type { Difficulty, GameState } from "./types";

function solve(initial: GameState, deltaMs = 1000): GameState {
  let state = initial;
  let steps = 0;
  while (state.status === "playing" && steps++ < 200000 / deltaMs) {
    const lane = getHintLane(state);
    if (lane !== null) state = deployBox(state, lane);
    state = tickGame(state, deltaMs);
  }
  return state;
}

describe("deterministic ant puzzle", () => {
  it("solves all 300 levels at the actual 50ms simulation cadence", () => {
    for (const difficulty of ["easy", "normal", "hard"] as Difficulty[]) {
      for (let level = 1; level <= 100; level++) {
        const final = solve(createGame(level, difficulty), 50);
        expect(final.status, `${difficulty} ${level}`).toBe("won");
        expect(final.collected).toBe(final.total);
      }
    }
  }, 30000);
  it.each(["easy", "normal", "hard"] as Difficulty[])(
    "solves every %s level by a constructive strategy",
    (difficulty) => {
      for (let level = 1; level <= 100; level++) {
        const state = solve(createGame(level, difficulty));
        expect(state.status, `${difficulty} ${level}`).toBe("won");
        expect(state.collected).toBe(state.total);
        expect(
          state.pixels.every((pixel) => pixel.status === "deposited"),
        ).toBe(true);
        expect(state.ants).toHaveLength(0);
      }
    },
  );

  it("generates identical levels and conserves every pixel across box capacities", () => {
    const state = createGame(42, "hard");
    expect(state).toEqual(createGame(42, "hard"));
    expect(state.queues.flat().reduce((sum, box) => sum + box.count, 0)).toBe(
      state.total,
    );
    expect(new Set(state.queues.flat().map((box) => box.id)).size).toBe(
      state.queues.flat().length,
    );
    for (const color of Object.keys(PALETTE)) {
      expect(
        state.queues
          .flat()
          .filter((box) => box.color === color)
          .reduce((sum, box) => sum + box.count, 0),
      ).toBe(state.pixels.filter((pixel) => pixel.color === color).length);
    }
    expect(createGame(43, "hard").pixels).not.toEqual(state.pixels);
    expect(createGame(42, "easy").pixels).toEqual(state.pixels);
    expect(createGame(42, "easy").queues).not.toEqual(state.queues);
  });

  it("reserves exposed pixels and wins only after ants deposit", () => {
    const initial = createGame(1, "easy");
    const exposed = exposedIds(initial);
    const next = deployBox(initial, getHintLane(initial)!);
    expect(initial.ants).toHaveLength(0);
    expect(next.ants.length).toBeGreaterThan(0);
    expect(next.ants.every((ant) => exposed.includes(ant.pixelId))).toBe(true);
    expect(next.collected).toBe(0);
    expect(
      next.pixels.filter((pixel) => pixel.status === "reserved").length,
    ).toBe(next.ants.length);
    const carried = tickGame(
      next,
      Math.min(...next.ants.map((ant) => ant.durationMs)),
    );
    expect(carried.collected).toBe(0);
    expect(carried.pixels.some((pixel) => pixel.status === "carried")).toBe(
      true,
    );
  });

  it("is independent of render-frame partitioning", () => {
    const deployed = deployBox(createGame(7, "normal"), 0);
    const large = tickGame(deployed, 2000);
    let small = deployed;
    for (let index = 0; index < 200; index++) small = tickGame(small, 10);
    expect(small).toEqual(large);
  });

  it("speeds up ants while preserving the real-time deadline", () => {
    const state = deployBox(createGame(1, "easy"), 0);
    const interval = Math.max(...state.ants.map((cat) => cat.durationMs));
    const normal = tickGame(state, interval);
    const fast = tickGame(state, interval, 3);
    expect(normal.elapsedMs).toBe(interval);
    expect(fast.elapsedMs).toBeCloseTo(interval);
    expect(fast.collected).toBeGreaterThan(normal.collected);
    expect(fast.timeLimitMs).toBe(normal.timeLimitMs);
    const noAnts = createGame(1, "hard");
    expect(tickGame(noAnts, 1000, 3).elapsedMs).toBe(1000);
    expect(tickGame(noAnts, noAnts.timeLimitMs, 3).lossReason).toBe("time");
    expect(tickGame(state, interval, Number.NaN)).toEqual(normal);
    const expected = tickGame(state, 1500, 3);
    let partitioned = state;
    for (let step = 0; step < 60; step++)
      partitioned = tickGame(partitioned, 25, 3);
    expect(partitioned.collected).toBe(expected.collected);
    expect(partitioned.pixels).toEqual(expected.pixels);
    expect(partitioned.elapsedMs).toBeCloseTo(expected.elapsedMs);
  });

  it("keeps playing with an empty picture while the final carried pixels return", () => {
    let state = createGame(1, "easy");
    let observedFinalReturn = false;
    for (let step = 0; step < 4000 && state.status === "playing"; step++) {
      const lane = getHintLane(state);
      if (lane !== null) state = deployBox(state, lane);
      state = tickGame(state, 50);
      if (
        state.pixels.every(
          (pixel) => pixel.status === "carried" || pixel.status === "deposited",
        ) &&
        state.ants.length
      ) {
        observedFinalReturn = true;
        expect(state.status).toBe("playing");
        expect(state.collected).toBeLessThan(state.total);
      }
    }
    expect(observedFinalReturn).toBe(true);
    expect(state.status).toBe("won");
  });

  it("loses on timeout and ignores input after termination", () => {
    const lost = tickGame(createGame(100, "hard"), 1e9);
    expect(lost.status).toBe("lost");
    expect(lost.lossReason).toBe("time");
    expect(lost.elapsedMs).toBe(lost.timeLimitMs);
    expect(deployBox(lost, 0)).toBe(lost);
  });

  it("detects five blocked colors without prematurely losing while ants work", () => {
    const state = createGame(1, "easy");
    state.slots = Array.from({ length: 5 }, (_, id) => ({
      id,
      color: "violet",
      count: 1,
      collected: 0,
      pending: 0,
    }));
    const lost = tickGame(state, 1);
    expect(lost.status).toBe("lost");
    expect(lost.lossReason).toBe("blocked");
  });

  it("rejects unsupported levels and ignores invalid queue inputs", () => {
    expect(() => createGame(0, "easy")).toThrow(RangeError);
    expect(() => createGame(101, "easy")).toThrow(RangeError);
    const state = createGame(1, "easy");
    expect(deployBox(state, -1)).toBe(state);
    expect(deployBox(state, 1.5)).toBe(state);
    expect(tickGame(state, Number.NaN)).toBe(state);
  });

  it("bounds concurrent ants and prevents deploying into five occupied slots", () => {
    let state = createGame(100, "hard");
    for (let index = 0; index < 5; index++) state = deployBox(state, index % 3);
    expect(state.slots.filter(Boolean)).toHaveLength(5);
    expect(deployBox(state, 0)).toBe(state);
    for (let step = 0; step < 10; step++) {
      state = tickGame(state, 200);
      expect(state.ants.length).toBeLessThanOrEqual(MAX_ACTIVE_ANTS);
      expect(new Set(state.ants.map((ant) => ant.pixelId)).size).toBe(
        state.ants.length,
      );
    }
  });

  it("can reach a genuine deadlock by repeatedly choosing inaccessible front colors", () => {
    let foundDeadlock = false;
    for (let level = 1; level <= 100 && !foundDeadlock; level++) {
      let state = createGame(level, "hard");
      for (let step = 0; step < 300 && state.status === "playing"; step++) {
        const visibleColors = new Set(
          exposedIds(state).map((id) => state.pixels[id].color),
        );
        const lanes = [0, 1, 2].filter((lane) => state.queues[lane].length);
        const blocked = lanes.find(
          (lane) => !visibleColors.has(state.queues[lane][0].color),
        );
        if (lanes.length && state.slots.includes(null)) {
          const lane = blocked ?? lanes[(step + level) % lanes.length];
          state = deployBox(state, lane);
        }
        state = tickGame(state, 1000);
      }
      foundDeadlock = state.lossReason === "blocked";
    }
    expect(foundDeadlock).toBe(true);
  });

  it("recommends exposed work when an out-of-order box has stopped", () => {
    const state = createGame(1, "hard");
    state.slots[0] = {
      id: -1,
      color: "cream",
      count: 1,
      pending: 0,
      collected: 0,
    };
    expect(state.ants).toHaveLength(0);
    expect(
      exposedIds(state).some((id) => state.pixels[id].color === "ink"),
    ).toBe(true);
    const lane = getHintLane(state);
    expect(lane).toBe(0);
    const next = deployBox(state, lane!);
    expect(next.ants.length).toBeGreaterThan(0);
    expect(tickGame(next, 10000).collected).toBeGreaterThan(state.collected);
  });

  it("waits while the oldest active box is making progress", () => {
    const initial = createGame(1, "easy");
    const state = deployBox(initial, getHintLane(initial)!);
    expect(state.ants.length).toBeGreaterThan(0);
    expect(getHintLane(state)).toBeNull();
  });

  it("preserves recognizable art and raises difficulty through box splitting and time", () => {
    const easy = createGame(11, "easy");
    const hard = createGame(11, "hard");
    expect(easy.pixels).toEqual(hard.pixels);
    expect(hard.queues.flat().length).toBeGreaterThan(
      easy.queues.flat().length,
    );
    expect(hard.timeLimitMs).toBeLessThan(easy.timeLimitMs);
    expect(createGame(91, "hard").pixels).not.toEqual(hard.pixels);
  });

  it("preserves per-color inventory and unique carriers throughout seeded legal play", () => {
    let seed = 731;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let run = 0; run < 24; run++) {
      let state = createGame(
        1 + Math.floor(random() * 100),
        ["easy", "normal", "hard"][run % 3] as Difficulty,
      );
      const original = state;
      for (let step = 0; step < 250 && state.status === "playing"; step++) {
        if (random() < 0.35) state = deployBox(state, Math.floor(random() * 3));
        state = tickGame(state, 10 + Math.floor(random() * 160));
        expect(new Set(state.ants.map((ant) => ant.id)).size).toBe(
          state.ants.length,
        );
        expect(new Set(state.ants.map((ant) => ant.pixelId)).size).toBe(
          state.ants.length,
        );
        expect(state.ants.length).toBeLessThanOrEqual(MAX_ACTIVE_ANTS);
        expect(state.collected).toBe(
          state.pixels.filter((pixel) => pixel.status === "deposited").length,
        );
        for (const box of state.slots)
          if (box) {
            expect(box.collected + box.pending).toBeLessThanOrEqual(box.count);
            expect(box.pending).toBe(
              state.ants.filter(
                (ant) => state.slots[ant.slotIndex]?.id === box.id,
              ).length,
            );
          }
        for (const ant of state.ants) {
          expect(state.pixels[ant.pixelId].status).toBe(
            ant.phase === "outbound" ? "reserved" : "carried",
          );
          expect(state.pixels[ant.pixelId].color).toBe(
            state.slots[ant.slotIndex]?.color,
          );
        }
        for (const color of Object.keys(PALETTE)) {
          const deposited = state.pixels.filter(
            (pixel) => pixel.color === color && pixel.status === "deposited",
          ).length;
          const queued = state.queues
            .flat()
            .filter((box) => box.color === color)
            .reduce((sum, box) => sum + box.count, 0);
          const active = state.slots
            .filter((box) => box?.color === color)
            .reduce((sum, box) => sum + box!.count - box!.collected, 0);
          expect(deposited + queued + active).toBe(
            original.pixels.filter((pixel) => pixel.color === color).length,
          );
        }
      }
    }
  });

  it("reports hard-100 tick p95/max under concurrent legal play with a loose regression budget", () => {
    const samples: number[] = [];
    let peakAnts = 0;
    for (let run = 0; run < 12; run++) {
      let state = createGame(100, "hard");
      for (let step = 0; step < 200 && state.status === "playing"; step++) {
        if (state.slots.includes(null))
          state = deployBox(state, (step + run) % 3);
        peakAnts = Math.max(peakAnts, state.ants.length);
        const start = performance.now();
        state = tickGame(state, 50);
        samples.push(performance.now() - start);
      }
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    const max = samples.at(-1)!;
    console.info(
      `PERF hard100: ticks=${samples.length}, peakAnts=${peakAnts}/${MAX_ACTIVE_ANTS}, p95=${p95.toFixed(3)}ms, max=${max.toFixed(3)}ms`,
    );
    expect(peakAnts).toBeGreaterThanOrEqual(8);
    expect(samples.length).toBeGreaterThan(500);
    expect(p95).toBeLessThan(10);
    expect(max).toBeLessThan(250);
  });
});
