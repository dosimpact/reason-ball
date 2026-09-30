"use client";

import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import {
  ArrowLeft,
  Globe2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CharacterAvatar, useCharacterQuery } from "@/entities/character";
import { useLearningSnapshotQuery } from "@/entities/learning-session";
import { MissionCard, useMissionsQuery } from "@/entities/mission";
import { FavoriteButton } from "@/features/character-favorite";
import { CharacterReport } from "@/features/character-report";

export function CharacterDetailPage({ id }: { id: string }) {
  const { data: character, isPending: characterPending } = useCharacterQuery(id);
  const { data: allMissions = [], isPending: missionsPending } = useMissionsQuery();
  const { data: learning, isPending: learningPending } =
    useLearningSnapshotQuery();
  const missions = useMemo(
    () => allMissions.filter((mission) => mission.recommendedCharacterId === id),
    [allMissions, id],
  );
  const completed = learning?.completedMissionIds ?? [];

  if (characterPending || missionsPending || learningPending) {
    return <LoadingIndicator variant="page" label="캐릭터를 불러오고 있어요." />;
  }

  if (!character) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">캐릭터를 찾을 수 없어요.</h1>
        <Link href="/characters" className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">캐릭터 목록으로</Link>
      </div>
    );
  }

  const firstMission = missions[0];
  const relatedMissionsHref = `/missions?character=${encodeURIComponent(character.id)}`;

  return (
    <div className="pb-28 lg:pb-16" data-testid="character-detail">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 opacity-10" style={{ background: `linear-gradient(120deg, ${character.palette[0]}, transparent 55%, ${character.palette[1]})` }} />
        <div className="relative mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
          <Link href="/characters" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> 캐릭터 목록</Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[390px_1fr] lg:items-center">
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-[0_25px_80px_-35px_rgba(0,0,0,.55)]">
              <CharacterAvatar character={character} size="hero" className="h-[360px] sm:h-[440px]" />
              <div className="absolute right-4 top-4"><FavoriteButton characterId={character.id} characterName={character.name} /></div>
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-neutral-950/80 p-4 text-white backdrop-blur">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-white/55">Created by</p><p className="text-sm font-bold">{character.creator}</p></div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-card-foreground shadow-sm">{character.level}</span>
                <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-card-foreground shadow-sm"><Globe2 className="mr-1 inline size-3" /> {character.accent}</span>
                <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"><ShieldCheck className="mr-1 inline size-3" /> 안전한 학습 대화</span>
                {character.publishStatus ? <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{character.publishStatus === "published" ? "게시됨" : character.publishStatus === "archived" ? "보관됨" : "초안"}</span> : null}
              </div>
              <p className="mt-7 text-sm font-medium text-muted-foreground">{character.role}</p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{character.name}</h1>
              <p className="mt-4 text-lg font-medium leading-8 text-foreground">“{character.tagline}”</p>
              <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">{character.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">{character.personality.map((trait) => <span key={trait} className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-bold text-card-foreground">#{trait}</span>)}</div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={`/chat/${character.id}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground transition hover:bg-primary/90" data-testid="start-chat"><MessageCircle className="size-4 fill-current" /> {character.name}와 자유 대화</Link>
                {firstMission ? <Link href={`/missions/${firstMission.id}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-border bg-card/70 px-7 text-sm font-bold text-card-foreground">추천 미션 보기</Link> : null}
                <div className="text-foreground"><CharacterReport characterId={character.id} characterName={character.name} /></div>
              </div>
              <div className="mt-8 flex items-center gap-6 text-xs font-semibold text-muted-foreground"><span className="flex items-center gap-1.5"><Users className="size-4" /> {character.learnerCount.toLocaleString()}개 대화</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] space-y-10 px-5 py-10 sm:px-8 lg:px-12">
        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-6 text-card-foreground"><Target className="size-5 text-muted-foreground" /><h2 className="mt-5 text-xl font-bold">캐릭터의 존재 목적</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{character.personaGoal}</p><h3 className="mt-5 text-sm font-black">학습 목표</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{character.learningGoal}</p></article>
          <article className="rounded-2xl border border-border bg-card p-6 text-card-foreground"><Sparkles className="size-5 text-muted-foreground" /><h2 className="mt-5 text-xl font-bold">대화 스타일</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{character.speakingStyle}</p>{character.relationship ? <><h3 className="mt-5 text-sm font-black">학습자와의 관계</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{character.relationship}</p></> : null}{character.teachingStyle ? <><h3 className="mt-5 text-sm font-black">교육 태도</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{character.teachingStyle}</p></> : null}</article>
        </section>

        {missions.length > 0 ? <section aria-labelledby="character-missions"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">Missions together</p><h2 id="character-missions" className="mt-2 text-2xl font-bold">{character.name}와 도전할 미션</h2><p className="mt-2 text-sm text-muted-foreground">관련 미션 {missions.length}개 중 최대 6개를 보여드려요.</p></div>{missions.length > 6 ? <Link href={relatedMissionsHref} className="text-sm font-bold text-muted-foreground underline">관련 미션 모두 보기</Link> : null}</div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{missions.slice(0, 6).map((mission) => <MissionCard key={mission.id} mission={mission} completed={completed.includes(mission.id)} />)}</div></section> : null}
      </div>
    </div>
  );
}
