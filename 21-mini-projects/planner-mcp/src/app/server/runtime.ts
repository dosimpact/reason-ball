import path from "node:path";
import { PlannerStore } from "./store";
const globalRuntime = globalThis as typeof globalThis & {
  plannerStore?: Promise<PlannerStore>;
};
export function getStore() {
  globalRuntime.plannerStore ??= PlannerStore.open(
    process.env.PLANNER_DATA_DIR ?? path.join(process.cwd(), ".data"),
  );
  return globalRuntime.plannerStore;
}
