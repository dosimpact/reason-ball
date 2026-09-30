"use client";

import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import {
  ArrowRight,
  Play,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import {
  CharacterAvatar,
  CharacterCard,
  useCharactersQuery,
} from "@/entities/character";
import { useLearningPreferences } from "@/entities/learner";
import { beginnerHomeMissions, popularHomeCharacters, recommendHomeCharacters } from "./_lib/home-selection";
import { usesRemoteChatData } from "@/entities/chat";
import { conversationUrl } from "@/widgets/chat-workspace/model/conversation-url";
import { useLearningSnapshotQuery } from "@/entities/learning-session";
import { MissionCard, useMissionsQuery } from "@/entities/mission";
import { FavoriteButton } from "@/features/character-favorite";
import { LearningSummary } from "@/widgets/learning-progress/ui/learning-summary";

export default function HomePage() {
  const charactersQuery = useCharactersQuery();
  const { data: characters = [], isPending: charactersPending } = charactersQuery;
  const missionsQuery = useMissionsQuery();
  const { data: missions = [], isPending: missionsPending } = missionsQuery;
  const learningQuery = useLearningSnapshotQuery();
  const { data: learning } = learningQuery;
  const preferences = useLearningPreferences();
  const recommendations = recommendHomeCharacters(characters, preferences.data?.settings.interests ?? []);
  const popularCharacters = popularHomeCharacters(characters);
  const beginnerMissions = beginnerHomeMissions(missions);
  const histories = learning?.histories ?? [];
  const completedMissionIds = learning?.completedMissionIds ?? [];
  const favoriteCharacters = characters.filter((character) => learning?.favoriteCharacterIds.includes(character.id));
  const continueItem = histories[0];
  const continueCharacter = characters.find(
    (character) => character.id === continueItem?.characterId,
  );
  const continueMission = missions.find((mission) => mission.id === continueItem?.missionId);
  const continueConversationId = continueItem?.conversationId ?? (usesRemoteChatData() ? continueItem?.id : undefined);
  const continueHref = continueItem ? continueConversationId
    ? conversationUrl({ characterId: continueItem.characterId, missionId: continueItem.missionId, conversationId: continueConversationId })
    : `/chat/${encodeURIComponent(continueItem.characterId)}${continueItem.missionId ? `?mission=${encodeURIComponent(continueItem.missionId)}` : ""}`
    : undefined;
  // Archived resources can leave discovery while their owned conversation remains resumable.
  // History has no step-progress field; do not substitute a fabricated completion ratio.
  const continueAvatar = continueCharacter ?? { name: "저장된 캐릭터", emoji: "💬", palette: ["#5763d7", "#e16748"] as [string, string] };

  return (
    <div className="pb-28 lg:pb-16">
      <section className="relative mx-auto grid max-w-[1440px] items-center gap-8 overflow-hidden px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1fr] lg:py-8">
        <div className="relative z-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">A world of conversations</p>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">마음이 통하는 캐릭터,<br />새롭게 시작하는 영어.</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">상상 속 친구부터 일상 속 파트너까지.<br />나만의 캐릭터를 만나 이야기하고, 듣고, 배워 보세요.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[["☕", "카페"], ["✈️", "여행"], ["💼", "직장"], ["🎮", "취미"]].map(([emoji, topic]) => <Link key={topic} href={`/characters?q=${encodeURIComponent(topic)}`} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm transition hover:bg-muted">{emoji} {topic}</Link>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/characters" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">캐릭터 둘러보기 <ArrowRight className="size-4" /></Link>
            <Link href="/missions" data-testid="start-first-mission" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold">미션 둘러보기 <ChevronRight className="size-4" /></Link>
          </div>
        </div>
        <div className="relative flex min-h-64 items-center justify-center gap-3 py-5 sm:min-h-72" aria-label="추천 캐릭터 미리보기">
          {charactersPending ? <LoadingIndicator variant="inline" label="캐릭터를 불러오고 있어요." /> : characters.slice(0, 3).map((character, index) => <Link key={character.id} href={`/characters/${character.id}`} aria-label={`${character.name} 만나기`} className={`relative w-[30%] max-w-44 overflow-hidden rounded-2xl shadow-2xl transition hover:-translate-y-2 ${index === 1 ? "-translate-y-4" : index === 0 ? "-rotate-6" : "rotate-6"}`}><CharacterAvatar character={character} size="hero" className="!h-auto aspect-[3/5]" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12 text-sm font-bold text-white">{character.name}</div></Link>)}
          {!charactersPending && !characters.length && !charactersQuery.isError ? <Link href="/characters/new" className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">첫 캐릭터의 이야기를 만들어 보세요 <ArrowRight className="mx-auto mt-4 size-5" /></Link> : null}
        </div>
      </section>

      {(charactersQuery.isError || missionsQuery.isError || learningQuery.isError) ? <div role="alert" className="mx-auto max-w-[1440px] px-5 pt-6 text-sm"><p>일부 학습 정보를 불러오지 못했어요.</p><button type="button" className="mt-2 font-bold underline" onClick={() => { void charactersQuery.refetch(); void missionsQuery.refetch(); void learningQuery.refetch(); }}>다시 불러오기</button></div> : null}

      <div className="mx-auto max-w-[1440px] space-y-10 px-5 py-5 sm:px-8 lg:py-6">
        <section aria-labelledby="characters-title" data-testid="home-recommendations">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-muted-foreground">Your conversation partners</p>
              <h2 id="characters-title" className="mt-2 text-2xl font-bold tracking-tight">오늘의 추천 캐릭터</h2>
            </div>
            <Link href="/characters" className="flex shrink-0 items-center gap-1 text-sm font-bold">
              모두 보기 <ChevronRight className="size-4" />
            </Link>
          </div>
          <p className="mb-4 text-sm text-muted-foreground" data-testid="home-recommendation-basis">{preferences.isError ? "학습 설정을 불러오지 못해 일반 추천을 보여드려요." : preferences.isPending ? "학습 설정을 확인하는 동안 일반 추천을 보여드려요." : preferences.data?.settings.interests.length ? "설정한 관심사와 겹치는 주제가 많은 캐릭터를 먼저 보여드려요." : "관심사를 설정하면 맞는 주제를 먼저 추천해 드려요."}</p>
          {charactersPending ? <LoadingIndicator variant="section" label="캐릭터를 불러오고 있어요." /> : !charactersQuery.isError && !recommendations.length ? <p>추천할 공개 캐릭터가 아직 없어요.</p> : null}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {recommendations.map(({ character, matchedInterests }) => (
              <div key={character.id}>
              <CharacterCard
                character={character}
                action={<FavoriteButton characterId={character.id} characterName={character.name} />}
              />
              <p className="mt-2 text-xs text-muted-foreground" data-testid={`recommendation-reason-${character.id}`}>{matchedInterests.length ? `관심사 일치: ${matchedInterests.join(", ")}` : "다른 주제도 만나보세요."}</p>
              </div>
            ))}
          </div>
        </section>

        {continueItem && continueHref ? (
          <section aria-labelledby="continue-title" data-testid="continue-learning">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-muted-foreground">Keep going</p>
                <h2 id="continue-title" className="mt-2 text-2xl font-bold tracking-tight">
                  최근 대화 이어하기
                </h2>
              </div>
              <Link href="/history" className="hidden items-center gap-1 text-sm font-bold sm:flex">
                전체 기록 <ChevronRight className="size-4" />
              </Link>
            </div>
            <article className="grid overflow-hidden rounded-[1.75rem] bg-neutral-950 text-white shadow-[0_25px_70px_-40px_rgba(0,0,0,.7)] md:grid-cols-[250px_1fr_auto] md:items-center">
              <CharacterAvatar character={continueAvatar} size="hero" className="h-48 md:h-full" />
              <div className="space-y-4 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-white/12 px-2.5 py-1">{continueMission?.category ?? (continueItem.missionId ? "저장된 미션 대화" : "자유 대화")}</span>
                  <span className="text-white/50">{continueItem.turnCount}개 메시지</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{continueItem.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">“{continueItem.preview}”</p>
                </div>
                <p className="text-xs text-white/55" data-testid="continue-learning-status">
                  저장된 대화에서 이어갑니다.
                </p>
              </div>
              <div className="p-6 pt-0 md:p-8 md:pl-0">
                <Link
                  href={continueHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-[#f5c758] md:w-auto"
                >
                  이어서 대화 <Play className="size-3.5 fill-current" />
                </Link>
              </div>
            </article>
          </section>
        ) : null}

        {favoriteCharacters.length > 0 ? <section aria-labelledby="favorite-characters-title" data-testid="home-favorite-characters"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Saved partners</p><h2 id="favorite-characters-title" className="mt-2 text-2xl font-bold tracking-tight">저장한 캐릭터와 다시 만나요</h2></div><Link href="/profile" className="flex shrink-0 items-center gap-1 text-sm font-bold">내 컬렉션 <ChevronRight className="size-4" /></Link></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{favoriteCharacters.slice(0, 3).map((character) => <CharacterCard key={character.id} character={character} action={<FavoriteButton characterId={character.id} characterName={character.name} />} />)}</div></section> : null}


        {characters.filter(character => character.visibility === "public" && character.publishStatus === "published").length > 1 ? <section aria-labelledby="popular-characters-title" data-testid="home-popular-characters">
          <h2 id="popular-characters-title" className="text-2xl font-bold tracking-tight">인기 캐릭터</h2>
          <p className="mt-2 mb-7 text-sm text-muted-foreground">저장된 대화 수 기준</p>
          {!popularCharacters.length ? <p>표시할 공개 캐릭터가 아직 없어요.</p> : null}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{popularCharacters.map(character => <CharacterCard key={character.id} character={character} />)}</div>
        </section> : null}

        <section aria-labelledby="missions-title" data-testid="home-beginner-missions">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-muted-foreground">Real-life missions</p>
              <h2 id="missions-title" className="mt-2 text-2xl font-bold tracking-tight">입문·초급 미션</h2>
            </div>
            <Link href="/missions" className="flex shrink-0 items-center gap-1 text-sm font-bold">
              모든 미션 <ChevronRight className="size-4" />
            </Link>
          </div>
          {missionsPending ? <LoadingIndicator variant="section" label="미션을 불러오고 있어요." /> : !missionsQuery.isError && !beginnerMissions.length ? <p>아직 시작할 입문·초급 미션이 없어요. <Link href="/profile" className="underline">학습 프로필</Link>에서 수준과 관심 상황을 설정해 주세요.</p> : null}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {beginnerMissions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} completed={completedMissionIds.includes(mission.id)} />
            ))}
          </div>
        </section>

        <LearningSummary xp={learning?.xp} />
      </div>
    </div>
  );
}
