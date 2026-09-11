"use client";

import { Heart, Settings2, StickyNote } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CharacterCard, useCharactersQuery } from "@/entities/character";
import { useLearningSnapshotQuery } from "@/entities/learning-session";
import { useMissionsQuery } from "@/entities/mission";
import { useMissionRunsQuery } from "@/entities/mission-run";
import { LearningNotebook } from "@/widgets/learning-notebook/ui/learning-notebook";
import { SavedMissions } from "@/widgets/saved-missions/ui/saved-missions";
import { CreatorLibrary } from "@/widgets/creator-library/ui/creator-library";
import { FavoriteButton } from "@/features/character-favorite";
import { RewardCollection } from "@/features/mission-reward";

import { defaultPreferences, useLearningPreferences } from "@/entities/learner";
import { LearningProgress } from "@/widgets/learning-progress/ui/learning-progress";
import { LearnerSettings } from "@/widgets/learner-settings/ui/learner-settings";

const tabs = ["학습 요약", "즐겨찾기", "보상 컬렉션", "학습 표현", "저장 미션", "복습 노트", "내 생성물", "설정"] as const;

export default function ProfilePage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("학습 요약");
  const { data: characters = [] } = useCharactersQuery();
  const { data: missions = [] } = useMissionsQuery();
  const { data: learning } = useLearningSnapshotQuery();
  const { data: missionRuns = [] } = useMissionRunsQuery();
  const preferences = useLearningPreferences();
  const preferencesReady = preferences.isSuccess;
  const visiblePreferences = preferences.data?.settings ?? defaultPreferences;
  const favoriteIds = learning?.favoriteCharacterIds ?? [];
  const completedIds = learning?.completedMissionIds ?? [];
  const rewardIds = learning?.unlockedRewardIds ?? [];
  const xp = learning?.xp ?? 0;
  const favorites = characters.filter((character) => favoriteIds.includes(character.id));
  const notes = missionRuns.filter((run) => run.reviewNote);

  return (
    <div className="pb-28 lg:pb-16" data-testid="profile-page" data-hydrated={preferencesReady}>
      <section className="bg-neutral-950 text-white">
        <div className="relative mx-auto max-w-[1240px] overflow-hidden px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="pointer-events-none absolute -right-32 -top-52 size-[32rem] rounded-full bg-[#5763d7]/35 blur-3xl" />
          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center">
            <div className="grid size-24 shrink-0 place-items-center rounded-[1.7rem] bg-gradient-to-br from-[#f06f52] to-[#f5c758] text-4xl shadow-xl">🌱</div>
            <div className="flex-1"><p className="text-xs font-black uppercase tracking-[.18em] text-[#f5c758]">{visiblePreferences.learnerLevel} learner</p><h1 className="mt-2 text-4xl font-black tracking-tight">{visiblePreferences.displayName}의 영어 여정</h1><p className="mt-2 text-sm text-white/55">틀려도 계속 말하는 용기를 모으는 중 · 하루 {visiblePreferences.dailyGoal}분 목표</p><p className="mt-5 text-sm font-bold text-[#f5c758]">누적 {xp.toLocaleString()} XP</p></div>
            <button type="button" onClick={() => setTab("설정")} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold hover:bg-white/10"><Settings2 className="size-4" /> 프로필 설정</button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12">
        <div className="mt-10 flex gap-1 overflow-x-auto border-b border-black/8" role="tablist" aria-label="프로필 콘텐츠">{tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${tab === item ? "border-neutral-950 text-neutral-950" : "border-transparent text-neutral-400"}`}>{item}</button>)}</div>

        {tab === "학습 요약" ? <LearningProgress completedCount={learning ? completedIds.length : undefined} dailyGoal={visiblePreferences.dailyGoal} /> : null}

        {tab === "즐겨찾기" ? <section className="mt-8" data-testid="profile-favorites">{favorites.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{favorites.map((character) => <CharacterCard key={character.id} character={character} action={<FavoriteButton characterId={character.id} characterName={character.name} />} />)}</div> : <div className="rounded-[1.5rem] border border-dashed py-16 text-center"><Heart className="mx-auto size-7 text-neutral-300" /><p className="mt-3 font-bold">아직 즐겨찾는 캐릭터가 없어요.</p><Link href="/characters" className="mt-4 inline-flex text-sm font-bold text-[#e16748]">캐릭터 만나기</Link></div>}</section> : null}

        {tab === "보상 컬렉션" ? <RewardCollection missions={missions} rewardIds={rewardIds} /> : null}

        {tab === "학습 표현" ? <LearningNotebook /> : null}

        {tab === "저장 미션" ? <SavedMissions /> : null}

        {tab === "복습 노트" ? (
          <section className="mt-8" data-testid="profile-review-notes">
            <div className="mb-6"><p className="text-xs font-black uppercase tracking-[.18em] text-[#5763d7]">Review notes</p><h2 className="mt-1 text-2xl font-black">다음 대화를 위한 메모</h2></div>
            {notes.length ? <div className="space-y-3">{notes.map((run) => <article key={run.id} className="rounded-2xl border border-black/7 bg-white p-5"><div className="flex items-start gap-3"><StickyNote className="mt-0.5 size-5 shrink-0 text-[#5763d7]" /><div><p className="font-black">{run.missionTitle}</p><p className="mt-1 text-sm leading-6 text-neutral-600">{run.reviewNote}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">시도 {run.attemptNumber} · 최고 {run.best?.score ?? run.score ?? 0}점</p></div></div></article>)}</div> : <div className="rounded-2xl border border-dashed py-14 text-center"><StickyNote className="mx-auto size-7 text-neutral-300" /><p className="mt-3 font-bold">저장한 복습 메모가 없어요.</p><p className="mt-1 text-sm text-neutral-500">미션 평가 결과에서 다음 목표를 기록해 보세요.</p></div>}
          </section>
        ) : null}

        {tab === "내 생성물" ? <CreatorLibrary /> : null}

        {tab === "설정" ? <LearnerSettings /> : null}
      </div>
    </div>
  );
}
