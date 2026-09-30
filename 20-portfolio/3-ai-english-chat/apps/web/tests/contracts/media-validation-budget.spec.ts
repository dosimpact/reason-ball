import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { readMediaBudget, reserveMediaRequest } from "../e2e/live/media-budget";

test("paid image reservations persist across runs and stop at the shared cap", () => {
  const directory = mkdtempSync(join(tmpdir(), "lingua-budget-"));
  const path = join(directory, "budget.json");
  try {
    writeFileSync(path, JSON.stringify({ image: { maxRequests: 10, reservedRequests: 9 }, video: { maxRequests: 5, reservedRequests: 0, maxDurationSeconds: 3 }, events: [] }));
    reserveMediaRequest("image", 0, path);
    expect(readMediaBudget(path).image.reservedRequests).toBe(10);
    expect(() => reserveMediaRequest("image", 0, path)).toThrow(/exhausted/);
    expect(readMediaBudget(path).events).toHaveLength(1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("a 3s video cap rejects 4s and 8s without spending a reservation", () => {
  const directory = mkdtempSync(join(tmpdir(), "lingua-budget-"));
  const path = join(directory, "budget.json");
  try {
    const initial = JSON.stringify({ image: { maxRequests: 10, reservedRequests: 6 }, video: { maxRequests: 5, reservedRequests: 0, maxDurationSeconds: 3 }, events: [] });
    writeFileSync(path, initial);
    for (const seconds of [0, 4, 8]) expect(() => reserveMediaRequest("video", seconds, path)).toThrow(/duration/);
    expect(readFileSync(path, "utf8")).toBe(initial);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
