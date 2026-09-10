import { applyLocalActivity, initialLocalActivity, localActivityRequestSchema, localActivitySchema, type LocalActivityRequest } from "../model/local-activity";

export const localActivityKey = "lingua-learning-activity-v1";

export function createLocalActivityRepository(storage: Pick<Storage, "getItem" | "setItem">) {
  function read(now: number) {
    const value = storage.getItem(localActivityKey);
    if (value !== null) return localActivitySchema.parse(JSON.parse(value));
    const initial = initialLocalActivity(now);
    storage.setItem(localActivityKey, JSON.stringify(initial));
    return initial;
  }
  return {
    read,
    record(request: LocalActivityRequest, now: number) {
      const next = applyLocalActivity(read(now), request, now);
      storage.setItem(localActivityKey, JSON.stringify(next.state));
      return next.result;
    },
  };
}

export async function withLocalActivity<T>(operation: (repository: ReturnType<typeof createLocalActivityRepository>) => T) {
  if (!navigator.locks) throw new Error("이 브라우저에서는 안전한 활동 기록 저장을 지원하지 않아요.");
  return navigator.locks.request(localActivityKey, () => operation(createLocalActivityRepository(window.localStorage)));
}

// Adapter for the shared recorder; no mock activity request reaches the network.
export const localActivityFetch: typeof fetch = async (_url, init) => {
  const request = localActivityRequestSchema.parse(JSON.parse(String(init?.body)));
  const activity = await withLocalActivity((repository) => repository.record(request, Date.now()));
  return Response.json({ activity });
};
