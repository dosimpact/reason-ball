import { isArray, isPlainObject, isString, map } from "remeda";
import { z } from "zod";

export type PreviewImage = {
  dataUrl: string;
  name: string;
  mimeType: string;
  size: number;
};

export const maxImageBytes = 1_500_000;

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

export const recordImageObservationsParameters = z.object({
  subject: z.string(),
  visible_text: z.string().optional(),
  colors: z.string().optional(),
});

export const describeTextOnlyRequestParameters = z.object({
  prompt: z.string(),
});
