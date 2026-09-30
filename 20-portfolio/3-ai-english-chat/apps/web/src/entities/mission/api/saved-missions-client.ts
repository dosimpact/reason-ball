import { savedMissionListSchema, savedMissionRequestSchema, savedMissionResultSchema, type SavedMissionRequest } from "../model/saved-missions";

export function remoteSavedMissionsEnabled() {
  return process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock" && process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase";
}

export function createHttpSavedMissions(fetcher: typeof fetch = fetch) {
  return {
    async read() {
      const response = await fetcher("/api/me/saved-missions", { cache: "no-store" });
      if (!response.ok) throw new Error("저장 미션을 불러오지 못했어요.");
      return savedMissionListSchema.parse((await response.json()).items);
    },
    async set(raw: SavedMissionRequest) {
      const request = savedMissionRequestSchema.parse(raw);
      const response = await fetcher("/api/me/saved-missions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(response.status === 409 ? "저장 요청이 충돌했어요. 기존 상태를 유지했습니다." : "저장 상태를 변경하지 못했어요. 같은 요청으로 다시 시도해 주세요.");
      const result = savedMissionResultSchema.parse((await response.json()).result);
      if (result.missionId !== request.missionId || result.saved !== request.saved) throw new Error("저장 응답을 확인하지 못했어요. 같은 요청으로 다시 시도해 주세요.");
      return result;
    },
  };
}
