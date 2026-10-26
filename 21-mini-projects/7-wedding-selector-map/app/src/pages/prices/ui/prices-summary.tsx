import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import {
  ArrowDownRight,
  ChartNoAxesColumnIncreasing,
  Check,
  Info,
} from "lucide-react";
import { money, number } from "@/shared/lib/format";
import type { PriceBrowserProps } from "../model/use-price-browser";
type Props = PriceBrowserProps<"filters" | "summary" | "metricLabel">;
function PricesIntro({ filters, summary, metricLabel }: Props) {
  return (
    <section className="prices-intro">
      <div className="prices-context-pill">
        <ChartNoAxesColumnIncreasing size={18} strokeWidth={1.2} />
        <div>
          <strong>
            {filters.kind === "venue" ? "웨딩홀 가격표" : "웨딩 파트너 가격표"}
          </strong>
          <span>{metricLabel}</span>
        </div>
      </div>
      <div className="prices-stats">
        <article>
          <span>검색 결과</span>
          <strong>
            {number(summary.count)}
            <small>곳</small>
          </strong>
          <p>선택한 조건의 업체</p>
        </article>
        <article>
          <span>
            <Check size={11} />
            가격 확인 가능
          </span>
          <strong>
            {number(summary.pricedCount)}
            <small>곳</small>
          </strong>
          <p>미확인 {number(summary.unknownCount)}곳 별도</p>
        </article>
        <article>
          <span>중앙값</span>
          <strong>
            {summary.median == null ? "—" : money(summary.median)}
          </strong>
          <p>{metricLabel} · 최저금액 기준</p>
        </article>
        <article>
          <span>
            <ArrowDownRight size={12} />
            가장 낮은 참고금액
          </span>
          <strong>{summary.min == null ? "—" : money(summary.min)}</strong>
          <p>
            {summary.max == null
              ? "비교할 가격 정보가 없어요"
              : `업체별 최저금액 범위 ${money(summary.min)} ~ ${money(summary.max)}`}
          </p>
        </article>
      </div>
      <p className="prices-method-note">
        <Info size={12} />
        {filters.kind === "venue"
          ? "홀별 식대 × 보증인원을 반영한 적용 인원 + 확인된 대관료. 장식·미확인 필수 비용은 별도인 참고액입니다."
          : "선택한 상품·단위의 기본가를 비교합니다. 성별·구성·적용기간에 따른 차이를 함께 확인하세요. 합계 패키지로 계산하지 않습니다."}
      </p>
    </section>
  );
}

export function PricesSummaryDialog(props: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="prices-summary-trigger">
          <ChartNoAxesColumnIncreasing size={15} />
          가격 요약
        </button>
      </DialogTrigger>
      <DialogContent className="prices-summary-dialog">
        <DialogHeader>
          <DialogTitle>현재 검색 결과의 가격 요약</DialogTitle>
          <DialogDescription>
            {props.metricLabel} · 현재 필터 결과 전체를 기준으로 집계합니다.
          </DialogDescription>
        </DialogHeader>
        <PricesIntro {...props} />
      </DialogContent>
    </Dialog>
  );
}
