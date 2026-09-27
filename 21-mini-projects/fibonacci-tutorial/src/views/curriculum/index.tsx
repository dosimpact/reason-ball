"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, BookOpen, CircleCheck, Layers3, Play } from "lucide-react";
import type { Catalog } from "@/entities/tutorial";
import { TutorialSidebar } from "@/widgets/tutorial-sidebar";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
function readCompleted(): string {
  try { return window.localStorage.getItem("fibonacci-tutorial:completed") || "[]"; } catch { return "[]"; }
}
function completedIds(raw: string): string[] {
  try { const ids: unknown = JSON.parse(raw); return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
}

export function CurriculumView({ catalog, chapterId }: { catalog: Catalog; chapterId?: string }) {
  const completed = completedIds(useSyncExternalStore(subscribe, readCompleted, () => "[]"));
  const chapters = [...catalog.chapters].sort((a, b) => a.order - b.order);
  const selected = chapterId ? chapters.find((chapter) => chapter.id === chapterId) : undefined;
  const shown = selected ? [selected] : chapters;
  const total = chapters.reduce((sum, chapter) => sum + chapter.units.length, 0);
  const done = chapters.flatMap((chapter) => chapter.unitIds).filter((id) => completed.includes(id)).length;
  const next = chapters.flatMap((chapter) => chapter.units).find((unit) => !completed.includes(unit.id)) || chapters[0]?.units[0];
  const chapterIndex = selected ? chapters.findIndex((chapter) => chapter.id === selected.id) : -1;
  const prerequisite = chapterIndex > 0 ? chapters[chapterIndex - 1] : undefined;
  const firstIncomplete = selected?.units.find((unit) => !completed.includes(unit.id)) || selected?.units[0];

  return <div className="app-shell">
    <TutorialSidebar catalog={catalog} activeUnitId="" completedUnitIds={completed} />
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><Link href="/">Fibonacci Lab</Link><span>›</span><Link href="/tutorials">전체 커리큘럼</Link>{selected && <><span>›</span><span>{selected.title}</span></>}</div><div className="topbar-right"><span className="topbar-status"><span className="live-dot" /> 엘리엇 파동이론</span><div className="avatar">FL</div></div></header>
      <div className="page-content curriculum-page">
        <section className="curriculum-hero"><div className="hero-kicker"><Layers3 size={15} /> ELLIOTT WAVE LEARNING PATH</div><h1>{selected ? selected.title : <>파동을 읽는 과정, <em>처음부터 끝까지</em></>}</h1><p>{selected ? selected.description : "기초 카운팅에서 조정파와 대안 해석, 관측 후 재평가까지. 한 과정의 모든 챕터와 유닛을 살펴보세요."}</p><div className="curriculum-stats"><span><strong>{chapters.length}</strong> 챕터</span><span><strong>{total}</strong> 유닛</span><span><strong>{done}</strong> 완료</span></div>{!selected && next && <Link className="curriculum-primary" href={`/tutorials/${encodeURIComponent(next.id)}`}><Play size={15} /> {done ? "이어서 학습하기" : "첫 유닛 시작하기"} <ArrowRight size={15} /></Link>}{selected && firstIncomplete && <Link className="curriculum-primary" href={`/tutorials/${encodeURIComponent(firstIncomplete.id)}`}><Play size={15} /> {selected.units.some((unit) => completed.includes(unit.id)) ? "이어서 학습하기" : "챕터 시작하기"} <ArrowRight size={15} /></Link>}</section>
        {selected && <div className="curriculum-prerequisite"><strong>권장 선행</strong><span>{prerequisite ? <Link href={`/tutorials/chapters/${encodeURIComponent(prerequisite.id)}`}>{prerequisite.title} <ArrowRight size={13} /></Link> : "OHLC 캔들의 시가·고가·저가·종가와 시간 순서를 읽을 수 있으면 시작할 수 있습니다."}</span></div>}
        <div className="curriculum-section-heading"><div><span className="eyebrow">COURSE MAP</span><h2>{selected ? "이 챕터의 학습 유닛" : "전체 커리큘럼"}</h2></div><span>{selected ? `${selected.units.length}개 유닛` : `${chapters.length}개 챕터 · ${total}개 유닛`}</span></div>
        <div className="curriculum-chapters">{shown.map((chapter) => {
          const chapterDone = chapter.units.filter((unit) => completed.includes(unit.id)).length;
          return <section className="curriculum-chapter" key={chapter.id} aria-labelledby={`heading-${chapter.id}`}><div className="curriculum-chapter-head"><span className="curriculum-chapter-index">{String(chapter.order).padStart(2, "0")}</span><div><span className="eyebrow">CHAPTER {String(chapter.order).padStart(2, "0")}</span><h3 id={`heading-${chapter.id}`}><Link href={`/tutorials/chapters/${encodeURIComponent(chapter.id)}`}>{chapter.title}</Link></h3><p>{chapter.description}</p></div><span className="curriculum-chapter-progress">{chapterDone} / {chapter.units.length} 완료</span></div><div className="curriculum-unit-list">{chapter.units.map((unit, index) => <Link className="curriculum-unit" href={`/tutorials/${encodeURIComponent(unit.id)}`} key={unit.id}><span className="curriculum-unit-index">{String(index + 1).padStart(2, "0")}</span><span className="curriculum-unit-copy"><strong>{unit.title}</strong><small>{unit.description}</small><span className="curriculum-unit-tags"><b>{unit.mode === "theory" ? "이론" : "연습"}</b><span>{unit.objectives.join(" · ")}</span></span></span><span className="curriculum-unit-end">{completed.includes(unit.id) ? <CircleCheck size={18} aria-label="완료" /> : <ArrowRight size={17} aria-hidden="true" />}</span></Link>)}</div>{!selected && <Link className="curriculum-chapter-link" href={`/tutorials/chapters/${encodeURIComponent(chapter.id)}`}><BookOpen size={15} /> 챕터 자세히 보기 <ArrowRight size={15} /></Link>}</section>;
        })}</div>
        <p className="curriculum-footnote">각 유닛은 독립적으로 다시 학습할 수 있습니다. 선행 챕터는 권장 순서이며, 완료 여부는 제출한 학습 증거에 따라 기록됩니다.</p>
      </div>
    </main>
  </div>;
}
