import { isArray, isPlainObject, isString, map } from "remeda";
import { z } from "zod";

export type ReasoningStatus = {
  id: string;
  label: string;
  detail: string;
};

export function parseJson(result: unknown): Record<string, unknown> {
  if (isString(result)) {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseJson(parsed);
    } catch {
      return { text: result };
    }
  }
  if (isPlainObject(result)) return result as Record<string, unknown>;
  return {};
}

export function stringList(value: unknown): string[] {
  if (!isArray(value)) return [];
  return map(value, String);
}

export const publishReasoningSummaryParameters = z.object({
  task: z.string(),
});

export const lookupPolicyFactParameters = z.object({
  topic: z.string(),
});
