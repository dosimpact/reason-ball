"use client";

import { ArrowLeft, CheckCircle2, Clock3, MapPin, MessageCircle, Play, Quote, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { CharacterAvatar, useCharacterQuery } from "@/entities/character";
import { useLearningSnapshotQuery } from "@/entities/learning-session";
import { useMissionQuery } from "@/entities/mission";
import { MissionReward } from "@/features/mission-reward";
import { SaveMissionButton } from "@/features/mission-save/ui/save-mission-button";

export function MissionDetailPage({ id }: { id: string }) {
  const { data: mission, isPending: missionPending } = useMissionQuery(id);
  const { data: character, isPending: characterPending } = useCharacterQuery(
    mission?.recommendedCharacterId,
  );
  const { data: learning, isPending: learningPending } =
    useLearningSnapshotQuery();
  const completed = learning?.completedMissionIds.includes(id) ?? false;
  const unmetPrerequisites = (mission?.prerequisites ?? []).filter(
    (prerequisiteId) => !learning?.completedMissionIds.includes(prerequisiteId),
  );

  if (missionPending || (mission && characterPending) || learningPending) return <div className="mx-auto max-w-2xl px-5 py-24 text-center" role="status">미션을 불러오고 있어요.</div>;

  if (!mission) return <div className="mx-auto max-w-2xl px-5 py-24 text-center"><h1 className="text-3xl font-black">미션을 찾을 수 없어요.</h1><Link href="/missions" className="mt-6 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">미션 목록으로</Link></div>;

  return (
    <div className="pb-28 lg:pb-16" data-testid="mission-detail">
      <section className="overflow-hidden bg-neutral-950 text-white">
        <div className="relative mx-auto max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <div className="pointer-events-none absolute -right-20 -top-44 size-[30rem] rounded-full opacity-25 blur-3xl" style={{ background: mission.rewardPalette[1] }} />
          <Link href="/missions" className="relative inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"><ArrowLeft className="size-4" /> 미션 목록</Link>
          <div className="relative mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-[#5763d7] px-3 py-1.5">{mission.category}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{mission.difficulty}</span>{completed ? <span className="rounded-full bg-emerald-500/20 px-3 py-1.5 text-emerald-300">완료</span> : null}</div>
              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-.05em] sm:text-6xl">{mission.title}</h1>
              <div className="mt-5"><SaveMissionButton key={mission.id} missionId={mission.id} /></div>
              <p className="mt-4 text-xl font-semibold text-white/80">{mission.subtitle}</p>
              <p className="mt-5 max-w-2xl whitespace-pre-line leading-7 text-white/55">{mission.description}</p>
              <div className="mt-7 flex flex-wrap gap-5 text-xs font-semibold text-white/60"><span className="flex items-center gap-2"><MapPin className="size-4 text-[#f06f52]" />{mission.location}</span><span className="flex items-center gap-2"><Clock3 className="size-4" />약 {mission.durationMinutes}분</span></div>
              {unmetPrerequisites.length === 0 ? <Link href={`/chat/${mission.recommendedCharacterId}?mission=${mission.id}&attempt=new`} className="mt-9 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-7 text-sm font-black text-neutral-950 transition hover:bg-[#f5c758]" data-testid="start-mission"><Play className="size-4 fill-current" /> {completed ? "새 실행으로 다시 연습하기" : "미션 시작하기"}</Link> : <div className="mt-9 inline-flex min-h-13 items-center rounded-full bg-white/15 px-7 text-sm font-black text-white/65" role="status" data-testid="mission-prerequisite-gate">선수 미션을 먼저 완료해 주세요</div>}
            </div>
            <MissionReward mission={mission} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_350px] lg:px-12">
        <div className="space-y-14">
          <section aria-labelledby="objectives-title"><p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">Success checklist</p><h2 id="objectives-title" className="mt-2 text-3xl font-black">이것만 해내면 성공이에요</h2><ol className="mt-6 space-y-3">{mission.objectives.map((objective, index) => <li key={objective.id} className="flex gap-4 rounded-2xl border border-black/6 bg-white p-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-950 text-xs font-black text-white">{index + 1}</span><div><p className="font-bold">{objective.label}</p><p className="mt-1 text-sm text-neutral-500">힌트 · {objective.hint}</p></div></li>)}</ol></section>
          <section aria-labelledby="steps-title" data-testid="mission-detail-steps"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Mission flow</p><h2 id="steps-title" className="mt-2 text-3xl font-black">대화는 이 순서로 진행해요</h2><ol className="mt-6 grid gap-3 sm:grid-cols-2">{(mission.steps ?? mission.objectives.map((objective) => ({ ...objective, required: true, successCriteria: [objective.hint] }))).map((missionStep, index) => <li key={missionStep.id} className="rounded-2xl border border-black/6 bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs font-black text-emerald-700">STEP {index + 1}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${missionStep.required ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-500"}`}>{missionStep.required ? "필수" : "선택"}</span></div><p className="mt-3 font-black">{missionStep.label}</p><p className="mt-2 text-xs leading-5 text-neutral-500">판정 근거 · {missionStep.successCriteria.join(" · ")}</p></li>)}</ol></section>
          <section aria-labelledby="phrases-title"><p className="text-xs font-black uppercase tracking-[.18em] text-[#5763d7]">Useful phrases</p><h2 id="phrases-title" className="mt-2 text-3xl font-black">막힐 때 꺼내 쓸 표현</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{mission.keyPhrases.map((phrase) => <article key={phrase.english} className="rounded-2xl bg-[#f1f2ff] p-5"><Quote className="size-4 text-[#5763d7]" /><p className="mt-4 font-bold">{phrase.english}</p><p className="mt-1 text-sm text-neutral-500">{phrase.korean}</p></article>)}</div></section>
          {mission.exampleDialogue?.length ? <section aria-labelledby="mission-dialogue-title"><p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">Example dialogue</p><h2 id="mission-dialogue-title" className="mt-2 text-3xl font-black">시작 전 한 번 읽어 봐요</h2><div className="mt-6 space-y-3 rounded-[1.5rem] bg-neutral-950 p-6 text-sm text-white">{mission.exampleDialogue.map((turn, index) => <p key={`${turn.role}-${index}`} className={`max-w-[85%] rounded-2xl px-4 py-3 leading-6 ${turn.role === "learner" ? "ml-auto bg-[#5763d7]" : "bg-white/12"}`}><span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-white/50">{turn.role}</span>{turn.text}</p>)}</div></section> : null}
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {character ? <article className="rounded-[1.5rem] border border-black/6 bg-white p-5"><p className="text-xs font-bold text-neutral-400">함께할 캐릭터</p><div className="mt-4 flex items-center gap-3"><CharacterAvatar character={character} size="md" className="rounded-2xl" /><div><h2 className="text-lg font-black">{character.name}</h2><p className="text-xs text-[#e16748]">{character.role}</p></div></div><p className="mt-4 text-sm leading-6 text-neutral-600">{character.tagline}</p><Link href={`/characters/${character.id}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold">캐릭터 자세히 <MessageCircle className="size-3" /></Link></article> : null}
          <article className="rounded-[1.5rem] bg-[#fff1ec] p-5"><Target className="size-5 text-[#e16748]" /><h2 className="mt-4 font-black">평가는 이렇게 해요</h2><p className="mt-2 text-sm leading-6 text-neutral-600">문법 완벽성보다 의도 전달과 목표 표현 사용을 우선해요. 대화 흐름을 유지한 채 짧게 교정합니다.</p><div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="size-4" /> 필수 단계 + {mission.successThreshold ?? 75}점 이상이면 완료</div>{mission.prerequisites?.length ? <p className="mt-3 text-xs font-semibold text-neutral-500">선수 미션 · {mission.prerequisites.join(", ")}</p> : null}</article>
          <div className="flex items-center gap-2 rounded-2xl border border-black/6 bg-white p-4 text-xs text-neutral-500"><Sparkles className="size-4 shrink-0 text-[#5763d7]" />AI가 난이도를 대화 속도에 맞게 조절해요.</div>
        </aside>
      </div>
    </div>
  );
}
