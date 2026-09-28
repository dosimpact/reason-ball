import { BookOpen, ChevronRight, ChartNoAxesCombined, CircleCheck, Circle } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import type { Catalog } from "@/entities/tutorial";

export function TutorialSidebar({ catalog, activeUnitId, completedUnitIds = [], activeSection = "tutorials" }: { catalog?: Catalog; activeUnitId: string; completedUnitIds?: string[]; activeSection?: "tutorials" | "monitoring" }) {
  const total = catalog?.chapters.reduce((count, chapter) => count + chapter.units.length, 0) || 0;
  return <aside className="sidebar" aria-label="튜토리얼 챕터">
    <Link href="/" className="brand" aria-label="Fibonacci Lab 메인으로 이동"><div className="brand-mark"><ChartNoAxesCombined size={21} strokeWidth={2.2} /></div><div><strong>Fibonacci Lab</strong><span>차트를 읽는 새로운 감각</span></div></Link>
    <div className="sidebar-theme"><ThemeToggle /></div>
    <nav className="sidebar-workspace" aria-label="서비스 메뉴"><Link href="/monitoring" className={activeSection === "monitoring" ? "unit unit-active" : "unit"} aria-current={activeSection === "monitoring" ? "page" : undefined}><ChartNoAxesCombined size={16} />전략 모니터링</Link></nav>
    <div className="sidebar-scroll">
      <div className="sidebar-eyebrow">LEARNING PATH <span>{completedUnitIds.length.toString().padStart(2, "0")} / {total.toString().padStart(2, "0")}</span></div>
      {catalog?.chapters.map((chapter, chapterIndex) => <div className="chapter" key={chapter.id}>
        <div className="chapter-heading"><span className="chapter-number">{String(chapterIndex + 1).padStart(2, "0")}</span><Link href={`/tutorials/chapters/${encodeURIComponent(chapter.id)}`}>{chapter.title}</Link></div>
        <div className="chapter-units">{chapter.units.map((unit) => <Link href={`/tutorials/${encodeURIComponent(unit.id)}`} key={unit.id} className={unit.id === activeUnitId ? "unit unit-active" : "unit"} aria-current={unit.id === activeUnitId ? "page" : undefined}>
          <span className="unit-icon">{completedUnitIds.includes(unit.id) ? <CircleCheck size={16} /> : unit.id === activeUnitId ? <BookOpen size={16} /> : <Circle size={15} />}</span><span className="unit-label">{unit.title}</span>{unit.id === activeUnitId && <ChevronRight size={15} />}
        </Link>)}</div>
      </div>)}
      {!catalog && <div className="sidebar-placeholder">학습 경로를 불러오는 중입니다.</div>}
    </div>
    <Link href="/tutorials" className="sidebar-bottom"><div className="sidebar-bottom-icon"><BookOpen size={17} /></div><div><strong>전체 커리큘럼 보기</strong><span>{catalog ? `${catalog.chapters.length}개 챕터 · ${total}개 유닛` : "학습 경로 불러오는 중"}</span></div></Link>
  </aside>;
}
