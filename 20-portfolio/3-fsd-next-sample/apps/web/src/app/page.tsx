"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Play,
  Sparkles,
  Zap,
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
  const { data: characters = [], isPending: charactersPending } =
    useCharactersQuery();
  const { data: missions = [], isPending: missionsPending } = useMissionsQuery();
  const { data: learning, isPending: learningPending } =
    useLearningSnapshotQuery();
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

  if (charactersPending || missionsPending || learningPending) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center" role="status">
        <p className="text-sm font-bold text-neutral-500 dark:text-neutral-400">학습 공간을 준비하고 있어요.</p>
      </div>
    );
  }


  return (
    <div className="pb-28 lg:pb-16">
      <section className="relative overflow-hidden border-b border-border bg-[#f7f4ef] dark:bg-neutral-950">
        <div className="pointer-events-none absolute -right-32 -top-44 h-[32rem] w-[32rem] rounded-full bg-[#ffb399]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-56 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[#cabffd]/35 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1440px] gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f06f52]/20 bg-white/70 dark:bg-neutral-800/70 px-3 py-1.5 text-xs font-bold text-[#d55438] shadow-sm backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden="true" />
              영어가 필요한 바로 그 순간을 연습해요
            </div>
            <h1 className="text-balance text-5xl font-black leading-[1.02] tracking-[-0.065em] sm:text-7xl lg:text-[5.5rem]">
              외우지 말고,
              <br />
              <span className="text-[#f06f52]">캐릭터와 살아봐요.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300 sm:text-lg">
              좋아하는 캐릭터와 호텔, 카페, 이웃 만남 같은 실생활 미션을
              수행하세요. AI가 기다려 주고, 고쳐 주고, 다시 말할 용기를 줍니다.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/missions/hotel-check-in"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#f06f52] focus-visible:outline-2 focus-visible:outline-offset-2"
                data-testid="start-first-mission"
              >
                첫 미션 시작하기 <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/characters"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-neutral-800/70 px-6 text-sm font-bold backdrop-blur transition hover:bg-white dark:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                캐릭터 둘러보기
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {["가입 없이 체험", "원어민 음성 재생", "대화마다 맞춤 피드백"].map(
                (item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg" aria-label="학습 대화 미리보기">
            <div className="absolute -inset-6 rotate-3 rounded-[2.5rem] bg-[#f3c15c]/25" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 dark:border-white/10 bg-white/90 dark:bg-neutral-900/90 p-5 shadow-[0_30px_90px_-35px_rgba(67,42,20,.38)] backdrop-blur-xl sm:p-7">
              <div className="flex items-center gap-3 border-b border-black/6 dark:border-white/10 pb-5">
                {characters[0] ? <CharacterAvatar character={characters[0]} size="sm" className="rounded-full" /> : <span aria-hidden="true" className="text-3xl">💬</span>}
                <div>
                  <p className="font-bold">Mia와 체크인 연습</p>
                  <p className="text-xs text-emerald-600">● 지금 대화 가능</p>
                </div>
                <span className="ml-auto rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-700">
                  Mission 1/3
                </span>
              </div>
              <div className="space-y-4 py-6 text-sm">
                <div className="max-w-[83%] rounded-[1.25rem] rounded-tl-sm bg-[#f1eee8] dark:bg-neutral-800 px-4 py-3 leading-6">
                  Welcome! Do you have a reservation with us?
                  <button
                    type="button"
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#df654a]"
                    aria-label="예시 문장 음성 듣기"
                  >
                    <Play className="size-3 fill-current" /> 듣기
                  </button>
                </div>
                <div className="ml-auto max-w-[83%] rounded-[1.25rem] rounded-tr-sm bg-[#5763d7] px-4 py-3 leading-6 text-white">
                  Yes! I have a reservation under Minji Kim.
                </div>
                <div className="max-w-[83%] rounded-[1.25rem] rounded-tl-sm border border-emerald-100 bg-emerald-50 px-4 py-3 leading-6 text-emerald-950">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    Great expression
                  </span>
                  Perfect! “under + name” is exactly what locals say.
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-950 p-4 text-white">
                <div className="grid size-9 place-items-center rounded-full bg-[#f06f52]">
                  <Zap className="size-4 fill-current" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>오늘의 자신감</span><span>72%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-[72%] rounded-full bg-[#f8c95d]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] space-y-20 px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        {continueItem && continueHref ? (
          <section aria-labelledby="continue-title" data-testid="continue-learning">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">Keep going</p>
                <h2 id="continue-title" className="mt-2 text-3xl font-black tracking-tight">
                  어제의 용기를 이어가요
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

        {favoriteCharacters.length > 0 ? <section aria-labelledby="favorite-characters-title" data-testid="home-favorite-characters"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Saved partners</p><h2 id="favorite-characters-title" className="mt-2 text-3xl font-black tracking-tight">저장한 캐릭터와 다시 만나요</h2></div><Link href="/profile" className="flex shrink-0 items-center gap-1 text-sm font-bold">내 컬렉션 <ChevronRight className="size-4" /></Link></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{favoriteCharacters.slice(0, 3).map((character) => <CharacterCard key={character.id} character={character} action={<FavoriteButton characterId={character.id} characterName={character.name} />} />)}</div></section> : null}

        <section aria-labelledby="characters-title" data-testid="home-recommendations">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">Your conversation partners</p>
              <h2 id="characters-title" className="mt-2 text-3xl font-black tracking-tight">오늘의 추천 캐릭터</h2>
            </div>
            <Link href="/characters" className="flex shrink-0 items-center gap-1 text-sm font-bold">
              모두 보기 <ChevronRight className="size-4" />
            </Link>
          </div>
          <p className="mb-4 text-sm text-muted-foreground" data-testid="home-recommendation-basis">{preferences.isError ? "학습 설정을 불러오지 못해 일반 추천을 보여드려요." : preferences.isPending ? "학습 설정을 확인하는 동안 일반 추천을 보여드려요." : preferences.data?.settings.interests.length ? "설정한 관심사와 겹치는 주제가 많은 캐릭터를 먼저 보여드려요." : "관심사를 설정하면 맞는 주제를 먼저 추천해 드려요."}</p>
          {!recommendations.length ? <p>추천할 공개 캐릭터가 아직 없어요.</p> : null}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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

        <section aria-labelledby="popular-characters-title" data-testid="home-popular-characters">
          <h2 id="popular-characters-title" className="text-3xl font-black tracking-tight">인기 캐릭터</h2>
          <p className="mt-2 mb-7 text-sm text-muted-foreground">저장된 대화 수 기준</p>
          {!popularCharacters.length ? <p>표시할 공개 캐릭터가 아직 없어요.</p> : null}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{popularCharacters.map(character => <CharacterCard key={character.id} character={character} />)}</div>
        </section>

        <section aria-labelledby="missions-title" data-testid="home-beginner-missions">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#5763d7]">Real-life missions</p>
              <h2 id="missions-title" className="mt-2 text-3xl font-black tracking-tight">입문·초급 미션</h2>
            </div>
            <Link href="/missions" className="flex shrink-0 items-center gap-1 text-sm font-bold">
              모든 미션 <ChevronRight className="size-4" />
            </Link>
          </div>
          {!beginnerMissions.length ? <p>아직 공개된 입문·초급 미션이 없어요.</p> : null}
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
