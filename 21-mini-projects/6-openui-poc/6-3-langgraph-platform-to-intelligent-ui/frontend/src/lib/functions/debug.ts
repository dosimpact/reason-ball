import { defineFunction, type DefinedFunction } from "@openuidev/react-lang";
import type { z } from "zod/v4";

/** Log every registered function call without changing its contract or error handling. */
export function defineDebugFunction<T extends z.ZodObject, R extends z.ZodType | undefined = undefined>(
  definition: DefinedFunction<T, R>,
): DefinedFunction<T, R> {
  return defineFunction({
    ...definition,
    fn: (args) => {
      console.log(`[Intelligent UI fn] @${definition.name} input`, args);
      try {
        const result = definition.fn(args);
        console.log(`[Intelligent UI fn] @${definition.name} result`, result);
        return result;
      } catch (error) {
        console.log(`[Intelligent UI fn] @${definition.name} error`, error);
        throw error;
      }
    },
  });
}
