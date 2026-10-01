import type { Ant, GameState } from "./types";
import { exposedIds, collectionPath } from "./exterior";
export const MAX_ACTIVE_ANTS = 24;

function copyState(state: GameState): GameState {
  return {
    ...state,
    pixels: state.pixels.map((pixel) => ({ ...pixel })),
    ants: state.ants.map((ant) => ({ ...ant })),
    slots: state.slots.map((box) => box && { ...box }),
    queues: state.queues.map((queue) => queue.map((box) => ({ ...box }))),
  };
}

function launchAnts(state: GameState): void {
  const available = new Set(exposedIds(state));
  state.slots.forEach((box, slotIndex) => {
    if (!box) return;
    for (const id of available) {
      const pixel = state.pixels[id];
      if (state.ants.length >= MAX_ACTIVE_ANTS) break;
      if (box.collected + box.pending >= box.count) break;
      if (pixel.color !== box.color || !available.has(pixel.id)) continue;
      const route = collectionPath(state, pixel.id);
      if (!route.length) continue;
      available.delete(pixel.id);
      pixel.status = "reserved";
      box.pending++;
      state.ants.push({
        id: state.nextAntId++,
        pixelId: pixel.id,
        slotIndex,
        phase: "outbound",
        elapsedMs: 0,
        durationMs: Math.max(450, route.length * 55),
        route,
      });
    }
  });
}

function checkResult(state: GameState): void {
  if (state.collected === state.total) {
    state.status = "won";
    return;
  }
  if (state.elapsedMs >= state.timeLimitMs) {
    state.status = "lost";
    state.lossReason = "time";
    return;
  }
  if (state.slots.every(Boolean) && state.ants.length === 0) {
    const exposed = new Set(exposedIds(state));
    const canCollect = state.pixels.some(
      (pixel) =>
        exposed.has(pixel.id) &&
        state.slots.some((box) => box?.color === pixel.color),
    );
    if (!canCollect) {
      state.status = "lost";
      state.lossReason = "blocked";
    }
  }
}

export function deployBox(state: GameState, laneIndex: number): GameState {
  if (
    state.status !== "playing" ||
    !Number.isInteger(laneIndex) ||
    laneIndex < 0 ||
    laneIndex > 2
  )
    return state;
  const slotIndex = state.slots.indexOf(null);
  if (slotIndex < 0 || !state.queues[laneIndex].length) return state;
  const next = copyState(state);
  next.slots[slotIndex] = next.queues[laneIndex].shift()!;
  launchAnts(next);
  checkResult(next);
  return next;
}

/** Advance at exact ant-event boundaries, independent of render frame cadence. */
export function tickGame(
  state: GameState,
  deltaMs: number,
  speed = 1,
): GameState {
  if (state.status !== "playing" || !Number.isFinite(deltaMs) || deltaMs <= 0)
    return state;
  const next = copyState(state);
  const antSpeed = Number.isFinite(speed) ? Math.max(1, Math.min(3, speed)) : 1;
  let remaining = Math.min(deltaMs, next.timeLimitMs - next.elapsedMs);
  launchAnts(next);
  while (remaining > 0 && next.status === "playing") {
    const untilEvent = next.ants.length
      ? Math.min(
          ...next.ants.map(
            (ant) => (ant.durationMs - ant.elapsedMs) / antSpeed,
          ),
        )
      : remaining;
    const step = Math.min(remaining, untilEvent);
    next.elapsedMs += step;
    remaining -= step;
    for (const ant of next.ants) ant.elapsedMs += step * antSpeed;
    const survivors: Ant[] = [];
    for (const ant of next.ants) {
      if (ant.elapsedMs < ant.durationMs - 1e-7) {
        survivors.push(ant);
        continue;
      }
      const pixel = next.pixels[ant.pixelId];
      if (ant.phase === "outbound") {
        pixel.status = "carried";
        survivors.push({ ...ant, phase: "return", elapsedMs: 0 });
      } else {
        pixel.status = "deposited";
        next.collected++;
        const box = next.slots[ant.slotIndex]!;
        box.pending--;
        box.collected++;
        if (box.collected === box.count) next.slots[ant.slotIndex] = null;
      }
    }
    next.ants = survivors;
    launchAnts(next);
    checkResult(next);
  }
  checkResult(next);
  return next;
}

/** Recommend the next constructive-solution box; wait for earlier active work. */
export function getHintLane(state: GameState): number | null {
  if (state.status !== "playing" || !state.slots.includes(null)) return null;
  const activeIds = new Set(state.slots.filter(Boolean).map((box) => box!.id));
  const queuedIds = new Set(state.queues.flat().map((box) => box.id));
  const nextId = Math.min(...queuedIds, ...activeIds);
  if (activeIds.has(nextId)) {
    // Out-of-order choices can leave the oldest box waiting behind another color.
    // Waiting is useful only while ants are actually opening the picture.
    if (state.ants.length) return null;
    const exposedColors = new Set(
      exposedIds(state).map((id) => state.pixels[id].color),
    );
    const available = state.queues
      .map((queue, lane) => ({ box: queue[0], lane }))
      .filter(({ box }) => box && exposedColors.has(box.color))
      .sort((a, b) => a.box.id - b.box.id);
    return available[0]?.lane ?? null;
  }
  const lane = state.queues.findIndex((queue) => queue[0]?.id === nextId);
  return lane >= 0 ? lane : null;
}
