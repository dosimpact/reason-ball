import type { Difficulty } from "../../entities/game";
const key = "ant-atelier-progress-v1";
export function readProgress(): Partial<Record<Difficulty, number>> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const progress: Partial<Record<Difficulty, number>> = {};
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const level = (value as Record<string, unknown>)[difficulty];
      if (
        typeof level === "number" &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= 100
      )
        progress[difficulty] = level;
    }
    return progress;
  } catch {
    return {};
  }
}
export function saveProgress(difficulty: Difficulty, level: number) {
  try {
    const current = readProgress();
    localStorage.setItem(
      key,
      JSON.stringify({
        ...current,
        [difficulty]: Math.max(current[difficulty] || 1, Math.min(100, level)),
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}

const selectionKey = "ant-atelier-selection-v1";
export function readSelection(): { difficulty: Difficulty; level: number } {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(selectionKey) || "null",
    );
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (
        ["easy", "normal", "hard"].includes(String(record.difficulty)) &&
        typeof record.level === "number" &&
        Number.isInteger(record.level) &&
        record.level >= 1 &&
        record.level <= 100
      ) {
        return {
          difficulty: record.difficulty as Difficulty,
          level: record.level,
        };
      }
    }
  } catch {
    /* Storage is optional. */
  }
  return { difficulty: "normal", level: readProgress().normal || 1 };
}
export function saveSelection(difficulty: Difficulty, level: number) {
  try {
    localStorage.setItem(selectionKey, JSON.stringify({ difficulty, level }));
  } catch {
    /* Storage is optional. */
  }
}
