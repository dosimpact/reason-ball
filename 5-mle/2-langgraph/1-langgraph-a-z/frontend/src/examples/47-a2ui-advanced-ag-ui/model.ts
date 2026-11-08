import { filter, isArray, isPlainObject, isString } from "remeda";
import { z } from "zod";

export type JsonRecord = Record<string, unknown>;

export function parseResult(value: unknown): JsonRecord {
  if (isString(value)) {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseResult(parsed);
    } catch {
      return {};
    }
  }

  return isPlainObject(value) ? value : {};
}

export function records(value: unknown) {
  return isArray(value) ? filter(value, isPlainObject) : [];
}

export const buildAdvancedA2uiParameters = z.object({
  request: z.string().describe("The task that should produce advanced A2UI."),
});
