import { filter, isPlainObject, isString, isTruthy, map, pipe } from "remeda";
import { z } from "zod";

export type RecipeState = {
  title: string;
  servings: number;
  ingredients: string[];
  instructions: string[];
  notes: string;
};

export type ActivityEntry = {
  id: string;
  source: "ui" | "agent";
  detail: string;
};

export const initialRecipe: RecipeState = {
  title: "Weeknight Chickpea Bowls",
  servings: 2,
  ingredients: ["1 can chickpeas", "1 cup cooked rice", "1 cucumber", "2 tbsp yogurt sauce"],
  instructions: [
    "Warm chickpeas with a pinch of salt and paprika.",
    "Divide rice, chickpeas, cucumber, and sauce between bowls.",
  ],
  notes: "Keep it vegetarian and ready in 20 minutes.",
};

export function parseJsonResult(result: unknown): Record<string, unknown> {
  if (isString(result)) {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseJsonResult(parsed);
    } catch {
      return { text: result };
    }
  }
  if (isPlainObject(result)) {
    return result as Record<string, unknown>;
  }
  return {};
}

export function cleanLines(value: string) {
  return pipe(value.split("\n"), map((line) => line.trim()), filter(isTruthy));
}

export const suggestRecipePatchParameters = z.object({
  recipe_json: z.string(),
  request: z.string(),
});
