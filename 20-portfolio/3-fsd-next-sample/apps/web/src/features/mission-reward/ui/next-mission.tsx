/** @jsxImportSource react */
"use client";

import Link from "next/link";
import { useCharactersQuery } from "@/entities/character";
import { useMissionsQuery } from "@/entities/mission";
import { useLearningSnapshotQuery } from "@/entities/learning-session";
import { useLearningPreferences } from "@/entities/learner";
import { useUiMessages } from "@/shared/i18n/ui-messages-provider";
import { selectNextMission } from "../model/next-mission";

export function NextMission({ currentId, completed, characterId, assisted = false }: { currentId: string; completed: boolean; characterId?: string; assisted?: boolean }) {
  const missions = useMissionsQuery();
  const characters = useCharactersQuery();
  const learning = useLearningSnapshotQuery();
  const preferences = useLearningPreferences();
  const { missionResult: copy, languageTag } = useUiMessages();
  const queries = [missions, characters, learning, preferences];
  const failed = queries.some(query => query.isError);
  const loading = queries.some(query => query.isPending);
  const next = !failed && missions.data && characters.data && learning.data && preferences.data
    ? selectNextMission({ missions: missions.data, characters: characters.data, currentId,
      completedIds: [...learning.data.completedMissionIds, ...(completed ? [currentId] : [])], level: preferences.data.settings.learnerLevel }) : undefined;
  const current = !failed && !loading ? missions.data?.find(mission => mission.id === currentId && mission.publishStatus === "published") : undefined;
  const practiceAvailable = current?.recommendedCharacterId === characterId && characters.data?.some(character => character.id === characterId && character.publishStatus === "published" && character.visibility === "public");
  return <section data-testid="mission-next-recommendation" className="rounded-2xl border border-indigo-100 p-5">
    <h3 lang={languageTag} className="font-black">{copy.nextMission}</h3>
    {completed && assisted && characterId ? <div className="mt-3 rounded-xl bg-indigo-50 p-3" data-testid="independent-practice-recommendation"><p className="text-sm">힌트로 익힌 목표를 이번에는 도움 없이 말해 보세요.</p>{practiceAvailable ? <Link href={`/chat/${encodeURIComponent(characterId)}?${new URLSearchParams({ mission: currentId, attempt: "new" })}`} className="mt-2 inline-block font-bold text-indigo-800 underline" data-testid="independent-practice-link">힌트 없이 새 시도로 연습하기</Link> : current ? <Link href={`/missions/${encodeURIComponent(currentId)}`} className="mt-2 inline-block underline">현재 미션의 대화 상대 확인하기</Link> : <p className="mt-2 text-xs text-neutral-600">{loading ? "다시 연습할 미션을 확인하고 있어요." : "현재 이 미션의 새 연습 가능 여부를 확인할 수 없어요. 다른 미션에서도 같은 표현을 연습할 수 있어요."}</p>}</div> : null}
    {failed ? <div role="alert" className="mt-3 text-sm"><p>{copy.recommendationFailed}</p><button type="button" className="mt-2 underline" onClick={() => { for (const query of queries) void query.refetch(); }}>{copy.reloadRecommendation}</button></div>
      : loading ? <p role="status" className="mt-3 text-sm">{copy.recommendationLoading}</p>
      : next ? <div className="mt-3"><Link href={`/missions/${encodeURIComponent(next.id)}`} className="font-bold text-indigo-800" data-testid="next-mission-link">{next.title}</Link><p className="mt-2 text-xs text-neutral-600">{next.difficulty} · {copy.recommendationReason}</p></div>
      : <p className="mt-3 text-sm text-neutral-600">{copy.noRecommendation}</p>}
  </section>;
}
