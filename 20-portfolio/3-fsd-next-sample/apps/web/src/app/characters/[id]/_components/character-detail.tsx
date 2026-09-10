"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Globe2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Volume2,
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
    return <div className="mx-auto max-w-2xl px-5 py-24 text-center" role="status">캐릭터를 불러오고 있어요.</div>;
  }

  if (!character) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-3xl font-black">캐릭터를 찾을 수 없어요.</h1>
        <Link href="/characters" className="mt-6 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">캐릭터 목록으로</Link>
      </div>
    );
  }

  const firstMission = missions[0];
  const chatHref = firstMission
    ? `/chat/${character.id}?mission=${firstMission.id}`
    : `/chat/${character.id}`;

  return (
    <div className="pb-28 lg:pb-16" data-testid="character-detail">
      <section className="relative overflow-hidden border-b border-black/6">
        <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(120deg, ${character.palette[0]}, transparent 55%, ${character.palette[1]})` }} />
        <div className="relative mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
          <Link href="/characters" className="inline-flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-neutral-950"><ArrowLeft className="size-4" /> 캐릭터 목록</Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[390px_1fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[2rem] border-4 border-white shadow-[0_25px_80px_-35px_rgba(0,0,0,.55)]">
              <CharacterAvatar character={character} size="hero" className="h-[360px] sm:h-[440px]" />
              <div className="absolute right-4 top-4"><FavoriteButton characterId={character.id} characterName={character.name} /></div>
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-neutral-950/80 p-4 text-white backdrop-blur">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-white/55">Created by</p><p className="text-sm font-bold">{character.creator}</p></div>
                  <div className="flex items-center gap-1 text-sm font-bold text-amber-300"><Star className="size-4 fill-current" /> {character.rating.toFixed(1)}</div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow-sm">{character.level}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow-sm"><Globe2 className="mr-1 inline size-3" /> {character.accent}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><ShieldCheck className="mr-1 inline size-3" /> 안전한 학습 대화</span>
                {character.publishStatus ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{character.publishStatus === "published" ? "게시됨" : character.publishStatus === "archived" ? "보관됨" : "초안"}</span> : null}
              </div>
              <p className="mt-7 text-sm font-bold text-[#e16748]">{character.role}</p>
              <h1 className="mt-1 text-6xl font-black tracking-[-.07em] sm:text-7xl">{character.name}</h1>
              <p className="mt-4 text-xl font-semibold leading-8 text-neutral-700">“{character.tagline}”</p>
              <p className="mt-5 max-w-2xl leading-7 text-neutral-600">{character.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">{character.personality.map((trait) => <span key={trait} className="rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-xs font-bold">#{trait}</span>)}</div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={chatHref} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 text-sm font-bold text-white transition hover:bg-[#f06f52]" data-testid="start-chat"><MessageCircle className="size-4 fill-current" /> {character.name}와 대화하기</Link>
                {firstMission ? <Link href={`/missions/${firstMission.id}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-black/10 bg-white/70 px-7 text-sm font-bold">추천 미션 보기</Link> : null}
                <CharacterReport characterId={character.id} characterName={character.name} />
              </div>
              <div className="mt-8 flex items-center gap-6 text-xs font-semibold text-neutral-500"><span className="flex items-center gap-1.5"><Users className="size-4" /> {character.learnerCount.toLocaleString()}명 학습</span><span className="flex items-center gap-1.5"><Volume2 className="size-4" /> 음성 지원</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] space-y-16 px-5 py-14 sm:px-8 lg:px-12">
        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.5rem] border border-black/6 bg-white p-6"><Target className="size-5 text-[#f06f52]" /><h2 className="mt-5 text-xl font-black">캐릭터의 존재 목적</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{character.personaGoal}</p><h3 className="mt-5 text-sm font-black">학습 목표</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{character.learningGoal}</p></article>
          <article className="rounded-[1.5rem] border border-black/6 bg-white p-6"><Sparkles className="size-5 text-[#5763d7]" /><h2 className="mt-5 text-xl font-black">대화 스타일</h2><p className="mt-3 text-sm leading-6 text-neutral-600">{character.speakingStyle}</p>{character.relationship ? <><h3 className="mt-5 text-sm font-black">학습자와의 관계</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{character.relationship}</p></> : null}{character.teachingStyle ? <><h3 className="mt-5 text-sm font-black">교육 태도</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{character.teachingStyle}</p></> : null}</article>
        </section>

        <section aria-labelledby="preview-title" className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#5763d7]">Conversation preview</p><h2 id="preview-title" className="mt-2 text-3xl font-black">이런 대화를 나눠요</h2><ul className="mt-6 space-y-3 text-sm text-neutral-600">{["내 속도에 맞춘 짧은 문장", "실수해도 흐름을 끊지 않는 교정", "바로 쓸 수 있는 다음 문장 추천"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>
          <div className="space-y-4 rounded-[1.75rem] bg-neutral-950 p-6 text-sm text-white sm:p-8"><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/12 px-4 py-3 leading-6">Hi! Welcome to London. What brings you here?</div><div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#5763d7] px-4 py-3 leading-6">It&apos;s my first solo trip. I&apos;m a little nervous.</div><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/12 px-4 py-3 leading-6">That&apos;s exciting! “I&apos;m a little nervous” sounds perfectly natural. Where would you like to visit first?</div></div>
        </section>

        {missions.length > 0 ? <section aria-labelledby="character-missions"><div className="mb-6"><p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">Missions together</p><h2 id="character-missions" className="mt-2 text-3xl font-black">{character.name}와 도전할 미션</h2></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{missions.map((mission) => <MissionCard key={mission.id} mission={mission} completed={completed.includes(mission.id)} />)}</div></section> : null}
      </div>
    </div>
  );
}
