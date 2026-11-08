import { filter, isArray, isNumber, isPlainObject, isString, map, pipe } from "remeda";
import { z } from "zod";

export type JsonRecord = Record<string, unknown>;

export type Worker = {
  id: string;
  name: string;
  task: string;
  status: string;
  progress: number;
  partialResult: string;
  result: string;
};

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

export function workerList(value: unknown): Worker[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((worker, index) => ({
    id: isString(worker.id) ? worker.id : `worker-${index + 1}`,
    name: isString(worker.name) ? worker.name : `Worker ${index + 1}`,
    task: isString(worker.task) ? worker.task : "No task supplied.",
    status: isString(worker.status) ? worker.status : "unknown",
    progress: isNumber(worker.progress) ? worker.progress : Number(worker.progress ?? 0),
    partialResult: isString(worker.partial_result) ? worker.partial_result : "",
    result: isString(worker.result) ? worker.result : "",
  })));
}

export function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export const runSubgraphWorkersParameters = z.object({
  task: z.string().describe("The task that should be routed through worker subgraphs."),
});
