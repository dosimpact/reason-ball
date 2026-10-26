import { Flower2, ShieldCheck } from "lucide-react";
import { number } from "@/shared/lib/format";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerIntroProps = ExplorerSectionProps<"venueCount" | "planningCount">;
export function ExplorerIntro({
  venueCount,
  planningCount,
}: ExplorerIntroProps) {
  return (
    <section className="intro-section" aria-label="오롯 소개">
      <div className="intro-copy">
        <p className="eyebrow">A THOUGHTFUL BEGINNING, TOGETHER</p>
        <h1>
          둘의 시작에, <em>더 나은 선택을.</em>
          <Flower2 size={31} strokeWidth={1} />
        </h1>
        <p className="intro-description">
          분위기는 취향대로, 가격은 투명하게. 우리다운 결혼 준비의 시작.
        </p>
      </div>
      <div className="intro-proof">
        <div className="proof-icon">
          <ShieldCheck size={25} strokeWidth={1.2} />
        </div>
        <div>
          <span>한국소비자원 참가격 공개자료</span>
          <strong>
            웨딩홀 {number(venueCount)}건 <b>·</b> 준비대행{" "}
            {number(planningCount)}건
          </strong>
          <small>수집 자료 기준 · 공시 조건과 적용기간을 확인하세요</small>
        </div>
      </div>
      <div className="intro-flower" aria-hidden="true">
        ✳
      </div>
    </section>
  );
}
