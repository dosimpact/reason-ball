"use client";

import { Plus, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CharacterCard, useCharactersQuery } from "@/entities/character";
import { FavoriteButton } from "@/features/character-favorite";

const levels = ["전체", "입문", "초급", "중급"] as const;

export function CharacterExplorer() {
  const { data: characters = [] } = useCharactersQuery();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof levels)[number]>("전체");
  const [topic, setTopic] = useState("전체");
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [page, setPage] = useState(1);

  const topics = useMemo(
    () => ["전체", ...Array.from(new Set(characters.flatMap((character) => character.topics))).sort()],
    [characters],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return characters
      .filter((character) => {
        const matchesLevel = level === "전체" || character.level === level;
        const matchesTopic = topic === "전체" || character.topics.includes(topic);
        const haystack = [
          character.name,
          character.role,
          character.tagline,
          ...character.personality,
          ...character.topics,
        ]
          .join(" ")
          .toLowerCase();
        return matchesLevel && matchesTopic && (!keyword || haystack.includes(keyword));
      })
      .sort((left, right) =>
        sort === "popular"
          ? right.learnerCount - left.learnerCount
          : Date.parse(right.createdAt) - Date.parse(left.createdAt),
      );
  }, [characters, level, query, sort, topic]);

  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 pb-28 sm:px-8 lg:px-12 lg:py-16">
      <div className="grid gap-8 border-b border-black/8 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#e16748]">
            <Sparkles className="size-3.5" aria-hidden="true" /> Character universe
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-6xl">
            나와 잘 맞는 대화 상대
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-neutral-600">
            말투, 성격, 상황이 다른 캐릭터를 만나 보세요. 같은 영어도 누구와
            이야기하느냐에 따라 더 오래 기억됩니다.
          </p>
        </div>
        <Link
          href="/characters/new"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-bold text-white transition hover:bg-[#f06f52]"
        >
          <Plus className="size-4" aria-hidden="true" /> 나만의 캐릭터 만들기
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-[1.4rem] border border-black/6 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">캐릭터 검색</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="이름, 성격, 관심사로 검색"
            className="h-12 w-full rounded-xl bg-[#f7f4ef] pl-11 pr-4 text-sm outline-none ring-[#f06f52]/40 transition focus:ring-3"
            data-testid="character-search"
          />
        </label>
        <div className="flex items-center gap-1 overflow-x-auto" role="group" aria-label="레벨 필터">
          <SlidersHorizontal className="mx-2 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          {levels.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setLevel(item); setPage(1); }}
              aria-pressed={level === item}
              className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition ${
                level === item ? "bg-neutral-950 text-white" : "hover:bg-neutral-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="character-topic">관심사 필터</label>
        <select id="character-topic" value={topic} onChange={(event) => { setTopic(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/15 dark:bg-neutral-900" aria-label="관심사 필터" data-testid="character-topic-filter">
          {topics.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <p className="text-neutral-500">
          <strong className="text-neutral-950">{filtered.length}</strong>명의 캐릭터
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-400">정렬
          <select value={sort} onChange={(event) => { setSort(event.target.value as "popular" | "new"); setPage(1); }} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 font-bold text-neutral-700 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-200" aria-label="캐릭터 정렬">
            <option value="popular">인기순</option><option value="new">신규순</option>
          </select>
        </label>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="character-results">
          {visible.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              action={<FavoriteButton characterId={character.id} characterName={character.name} />}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-black/15 bg-white/50 px-6 py-20 text-center">
          <p className="font-bold">조건에 맞는 캐릭터가 없어요.</p>
          <p className="mt-2 text-sm text-neutral-500">검색어나 레벨을 바꿔 보세요.</p>
        </div>
      )}
      {pageCount > 1 ? <nav className="mt-8 flex justify-center gap-2" aria-label="캐릭터 페이지">{Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => <button key={item} type="button" onClick={() => setPage(item)} aria-current={currentPage === item ? "page" : undefined} className={`grid size-10 place-items-center rounded-full text-xs font-black ${currentPage === item ? "bg-neutral-950 text-white" : "bg-white"}`}>{item}</button>)}</nav> : null}
    </div>
  );
}
