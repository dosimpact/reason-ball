"use client";

import Link from "next/link";
import { useSavedMissions } from "@/entities/mission/api/use-saved-missions";
import { SaveMissionButton } from "@/features/mission-save/ui/save-mission-button";

export function SavedMissions() {
  const query = useSavedMissions();
  if (query.isError) return <section role="alert" className="mt-8 rounded-xl border p-6"><p>저장 미션을 불러오지 못했어요. 목록을 비우지 않았습니다.</p><button className="mt-3 underline" onClick={() => void query.refetch()}>저장 미션 다시 불러오기</button></section>;
  if (!query.data) return <p role="status" className="mt-8">저장 미션을 불러오고 있어요.</p>;
  return <section className="mt-8 space-y-5" data-testid="profile-saved-missions">
    <h2 className="text-2xl font-black">내가 저장한 미션</h2>
    <p className="text-sm text-neutral-500">미션 상세에서 직접 저장한 목록입니다. 대화 이력이나 완료 여부와는 별개예요.</p>
    {!query.data.length ? <div className="rounded-2xl border border-dashed p-8 text-center"><p>저장된 미션이 아직 없어요.</p><Link href="/missions" className="mt-3 inline-block underline">미션 둘러보기</Link></div> : null}
    <div className="grid gap-4 md:grid-cols-2">{query.data.map((item) => <article key={item.missionId} className="space-y-4 rounded-2xl border bg-white p-5">
      {item.mission ? <div><Link href={`/missions/${encodeURIComponent(item.mission.id)}`} className="font-black underline">{item.mission.title}</Link><p className="mt-2 text-sm text-neutral-500">{item.mission.summary}</p></div> : <div><h3 className="font-bold">현재 볼 수 없는 미션</h3><p className="mt-2 text-sm text-neutral-500">보관되었거나 공개 상태가 변경되었어요. 저장 목록에서는 해제할 수 있습니다.</p></div>}
      <p className="text-xs text-neutral-500">저장일 {item.savedAt.slice(0, 10)} · UTC</p>
      <SaveMissionButton missionId={item.missionId} />
    </article>)}</div>
  </section>;
}
