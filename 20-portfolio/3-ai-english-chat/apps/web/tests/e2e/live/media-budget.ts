import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const mediaBudgetPath = resolve("../../docs/stock/media-validation-budget.json");
type Kind = "image" | "video";
type Budget = {
  image: { maxRequests: number; reservedRequests: number };
  video: { maxRequests: number; reservedRequests: number; maxDurationSeconds: number };
  events: Array<{ kind: Kind; requests: number; note: string }>;
};

export function readMediaBudget(path = mediaBudgetPath): Budget {
  const budget = JSON.parse(readFileSync(path, "utf8")) as Budget;
  for (const kind of ["image", "video"] as const) {
    const limit = kind === "image" ? 10 : 5;
    if (!Number.isInteger(budget[kind]?.maxRequests) || budget[kind].maxRequests < 0 || budget[kind].maxRequests > limit
      || !Number.isInteger(budget[kind]?.reservedRequests) || budget[kind].reservedRequests < 0
      || budget[kind].reservedRequests > budget[kind].maxRequests) throw new Error("Invalid media validation budget; refusing paid requests.");
  }
  if (!Number.isFinite(budget.video.maxDurationSeconds) || budget.video.maxDurationSeconds <= 0 || !Array.isArray(budget.events)) throw new Error("Invalid media validation budget.");
  return budget;
}

/** Reserve before sending; failures/aborts consume the reservation, never refund it. */
export function reserveMediaRequest(kind: Kind, durationSeconds = 0, path = mediaBudgetPath) {
  const lock = `${path}.lock`;
  const fd = openSync(lock, "wx");
  try {
    const budget = readMediaBudget(path);
    if (budget[kind].reservedRequests >= budget[kind].maxRequests) throw new Error("Media validation budget exhausted; use mocks.");
    if (kind === "video" && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > budget.video.maxDurationSeconds)) throw new Error("Video duration exceeds the user-approved limit; use mocks.");
    budget[kind].reservedRequests += 1;
    budget.events.push({ kind, requests: 1, note: `${new Date().toISOString()} live E2E reservation${kind === "video" ? `, ${durationSeconds}s` : ""}; retained even on failure.` });
    writeFileSync(path, `${JSON.stringify(budget, null, 2)}\n`);
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}
