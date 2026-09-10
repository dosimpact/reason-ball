"use client";

import { Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCharactersQuery } from "@/entities/character";
import { useLearningSnapshotQuery } from "@/entities/learning-session";
import { MissionCard, useMissionsQuery } from "@/entities/mission";

const categories = ["전체", "여행", "일상", "관계", "업무"];

export function MissionExplorer() {
  const { data: missions = [] } = useMissionsQuery();
  const { data: characters = [] } = useCharactersQuery();
  const { data: learning } = useLearningSnapshotQuery();
  const completedIds = learning?.completedMissionIds ?? [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [difficulty, setDifficulty] = useState("전체");
  const [duration, setDuration] = useState("전체");
  const [characterId, setCharacterId] = useState("전체");
  const [location, setLocation] = useState("전체");
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [page, setPage] = useState(1);

  const locations = useMemo(
    () => ["전체", ...Array.from(new Set(missions.map((mission) => mission.location.split("·")[0].trim()))).sort()],
    [missions],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return missions
      .filter((mission) => {
        const city = mission.location.split("·")[0].trim();
        const matchesCategory = category === "전체" || mission.category === category;
        const matchesDifficulty = difficulty === "전체" || mission.difficulty === difficulty;
        const matchesDuration = duration === "전체" || mission.durationMinutes <= Number(duration);
        const matchesCharacter = characterId === "전체" || mission.recommendedCharacterId === characterId;
        const matchesLocation = location === "전체" || city === location;
        const haystack = [mission.title, mission.subtitle, mission.location, mission.category, ...mission.keyPhrases.map((phrase) => phrase.english)].join(" ").toLowerCase();
        return matchesCategory && matchesDifficulty && matchesDuration && matchesCharacter && matchesLocation && (!keyword || haystack.includes(keyword));
      })
      .sort((left, right) => sort === "popular" ? right.learnerCount - left.learnerCount : Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }, [category, characterId, difficulty, duration, location, missions, query, sort]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 pb-28 sm:px-8 lg:px-12 lg:py-16">
      <div className="grid gap-8 border-b border-black/8 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#5763d7]"><Sparkles className="size-3.5" /> Real-world practice</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-6xl">오늘의 영어를 내일 바로 써요</h1><p className="mt-4 max-w-2xl leading-7 text-neutral-600">짧고 분명한 실생활 목표를 캐릭터와 함께 해결하세요. 미션을 완료하면 특별한 캐릭터 장면이 열려요.</p></div>
        <Link href="/missions/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-bold text-white transition hover:bg-[#5763d7]"><Plus className="size-4" /> 나만의 미션 만들기</Link>
      </div>
      <div className="mt-8 rounded-[1.4rem] border border-black/6 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <label className="relative block"><span className="sr-only">미션 검색</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="상황, 장소, 표현으로 검색" className="h-12 w-full rounded-xl bg-[#f7f4ef] pl-11 pr-4 text-sm outline-none ring-[#5763d7]/40 transition focus:ring-3" data-testid="mission-search" /></label>
        <div className="mt-3 flex gap-1 overflow-x-auto" role="group" aria-label="미션 카테고리 필터">{categories.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setPage(1); }} aria-pressed={category === item} className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition ${category === item ? "bg-[#5763d7] text-white" : "hover:bg-neutral-100"}`}>{item}</button>)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <select aria-label="장소 필터" value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} className="form-field m-0"><option value="전체">모든 장소</option>{locations.filter((item) => item !== "전체").map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="난이도 필터" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }} className="form-field m-0"><option value="전체">모든 난이도</option><option>입문</option><option>초급</option><option>중급</option></select>
          <select aria-label="소요 시간 필터" value={duration} onChange={(event) => { setDuration(event.target.value); setPage(1); }} className="form-field m-0"><option value="전체">모든 시간</option><option value="7">7분 이내</option><option value="10">10분 이내</option></select>
          <select aria-label="캐릭터 필터" value={characterId} onChange={(event) => { setCharacterId(event.target.value); setPage(1); }} className="form-field m-0"><option value="전체">모든 캐릭터</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select>
        </div>
      </div>
      <div className="mt-7 flex items-center justify-between"><p className="text-sm text-neutral-500"><strong className="text-neutral-950 dark:text-white">{filtered.length}</strong>개의 실전 미션</p><label className="flex items-center gap-2 text-xs font-semibold text-neutral-400">정렬<select aria-label="미션 정렬" value={sort} onChange={(event) => { setSort(event.target.value as "popular" | "new"); setPage(1); }} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 font-bold text-neutral-700 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-200"><option value="popular">인기순</option><option value="new">신규순</option></select></label></div>
      {filtered.length > 0 ? <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="mission-results">{visible.map((mission) => <MissionCard key={mission.id} mission={mission} completed={completedIds.includes(mission.id)} />)}</div> : <div className="mt-6 rounded-[1.5rem] border border-dashed border-black/15 bg-white/50 py-20 text-center"><p className="font-bold">조건에 맞는 미션이 없어요.</p><p className="mt-2 text-sm text-neutral-500">다른 검색어나 카테고리를 선택해 보세요.</p></div>}
      {pageCount > 1 ? <nav className="mt-8 flex justify-center gap-2" aria-label="미션 페이지">{Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => <button key={item} type="button" onClick={() => setPage(item)} aria-current={currentPage === item ? "page" : undefined} className={`grid size-10 place-items-center rounded-full text-xs font-black ${currentPage === item ? "bg-[#5763d7] text-white" : "bg-white"}`}>{item}</button>)}</nav> : null}
    </div>
  );
}
