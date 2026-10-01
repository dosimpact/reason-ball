import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readProgress,
  readSelection,
  saveProgress,
  saveSelection,
} from "./index";
describe("optional local progress", () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("rejects corrupted and out-of-range saved data", () => {
    for (const raw of [
      "null",
      "[]",
      "oops",
      '{"normal":101,"hard":-1,"easy":"4"}',
    ]) {
      data.set("ant-atelier-progress-v1", raw);
      expect(readProgress()).toEqual({});
    }
    data.set("ant-atelier-selection-v1", '{"difficulty":"unknown","level":1}');
    expect(readSelection()).toEqual({ difficulty: "normal", level: 1 });
  });
  it("preserves highest progress for each difficulty and last selected level", () => {
    saveProgress("easy", 10);
    saveProgress("easy", 2);
    saveProgress("hard", 105);
    expect(readProgress()).toEqual({ easy: 10, hard: 100 });
    saveSelection("easy", 7);
    expect(readSelection()).toEqual({ difficulty: "easy", level: 7 });
  });
  it("works with unavailable browser storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    expect(readProgress()).toEqual({});
    expect(() => saveProgress("normal", 2)).not.toThrow();
    expect(readSelection()).toEqual({ difficulty: "normal", level: 1 });
    expect(() => saveSelection("normal", 1)).not.toThrow();
  });
});
