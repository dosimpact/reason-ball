"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useSavedMissions, useSetSavedMission } from "@/entities/mission/api/use-saved-missions";
import type { SavedMissionRequest } from "@/entities/mission/model/saved-missions";

export function SaveMissionButton({ missionId }: { missionId: string }) {
  const query = useSavedMissions();
  const mutation = useSetSavedMission();
  const [pending, setPending] = useState<SavedMissionRequest | null>(null);
  const [error, setError] = useState("");
  const saved = query.data?.some((item) => item.missionId === missionId) ?? false;
  async function change() {
    if (!query.data || mutation.isPending) return;
    const request = pending ?? { requestId: crypto.randomUUID(), missionId, saved: !saved };
    setPending(request);
    setError("");
    try { await mutation.mutateAsync(request); setPending(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "저장 상태를 변경하지 못했어요."); }
  }
  if (query.isError) return <div className="text-sm"><p role="alert">저장 상태를 확인하지 못했어요.</p><button className="underline" onClick={() => void query.refetch()}>저장 상태 다시 불러오기</button></div>;
  return <div className="space-y-2">
    <button type="button" aria-pressed={saved} disabled={!query.data || mutation.isPending || query.isFetching} onClick={() => void change()} className="inline-flex items-center gap-2 rounded-full border border-current/25 px-4 py-2 text-sm font-bold disabled:opacity-50">
      <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} />{mutation.isPending ? "저장 상태 변경 중…" : pending ? "미션 저장 다시 시도" : !query.data ? "저장 상태 확인 중…" : saved ? "미션 저장 해제" : "미션 저장"}
    </button>
    {error ? <p role="alert" className="max-w-sm text-sm">{error}</p> : null}
  </div>;
}
