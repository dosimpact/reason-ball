import { localSavedMissionsSchema, setSavedMission, type SavedMissionRequest } from "../model/saved-missions";

export const savedMissionsStorageKey = "lingua-saved-missions-v1";
export function createLocalSavedMissions(storage: Pick<Storage, "getItem" | "setItem">) {
  function read() {
    const value = storage.getItem(savedMissionsStorageKey);
    return localSavedMissionsSchema.parse(value === null ? { version: 1, entries: [], receipts: [] } : JSON.parse(value));
  }
  return { read, set(request: SavedMissionRequest, savedAt: string) {
    const result = setSavedMission(read(), request, savedAt);
    if (!result.replayed) storage.setItem(savedMissionsStorageKey, JSON.stringify(result.state));
    return result.result;
  } };
}

export async function withLocalSavedMissions<T>(operation: (repository: ReturnType<typeof createLocalSavedMissions>) => T) {
  if (!navigator.locks) throw new Error("이 브라우저에서는 안전한 미션 저장을 지원하지 않아요.");
  return navigator.locks.request(savedMissionsStorageKey, () => operation(createLocalSavedMissions(window.localStorage)));
}
