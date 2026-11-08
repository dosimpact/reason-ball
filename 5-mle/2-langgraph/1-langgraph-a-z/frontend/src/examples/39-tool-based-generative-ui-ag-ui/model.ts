import { isPlainObject, isString } from "remeda";
import { z } from "zod";

export type HaikuPalette = {
  background?: string;
  accent?: string;
  text?: string;
};

export type HaikuPayload = {
  topic?: string;
  mood?: string;
  palette?: HaikuPalette;
  lines?: string[];
  explanation?: string;
};

export function normalizeHaiku(result: unknown): HaikuPayload {
  if (isString(result)) {
    try {
      return normalizeHaiku(JSON.parse(result));
    } catch {
      return {};
    }
  }

  if (isPlainObject(result)) {
    return result as HaikuPayload;
  }

  return {};
}

export const generateHaikuCardParameters = z.object({
  topic: z.string(),
  mood: z.string().optional(),
});
