import path from "node:path";
import { PlannerStore } from "./store";
const globalStore = globalThis as typeof globalThis & {
  planner2?: PlannerStore;
};
export function getStore() {
  return (globalStore.planner2 ??= new PlannerStore(
    path.join(
      process.env.PLANNER_DATA_DIR ?? path.resolve(".data"),
      "planner.sqlite",
    ),
  ));
}
