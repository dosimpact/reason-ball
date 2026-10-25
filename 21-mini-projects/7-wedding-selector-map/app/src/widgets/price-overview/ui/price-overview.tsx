"use client";
import { useMemo, useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  buildPriceHistogram,
  summarizePrices,
  type Vendor,
  type PriceBin,
  type PriceSummary,
} from "@/entities/vendor";
import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { overviewPoints, planningMetricOptions } from "../model/overview-data";
import "./price-overview.css";
interface Props {
  vendors: Vendor[];
  guests: number;
  selectedId?: string | null;
  defaultOpen?: boolean;
}
export function PriceOverview({
  vendors,
  guests,
  selectedId,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [venueMetric, setVenueMetric] = useState<"meal" | "estimate">("meal");
  const [planningMetric, setPlanningMetric] = useState("");
  const isVenue = vendors[0]?.kind === "venue";
  const options = useMemo(() => planningMetricOptions(vendors), [vendors]);
  const metric = isVenue
    ? venueMetric
    : (options.find((option) => option.key === planningMetric)?.key ??
      options[0]?.key ??
      "");
  const points = useMemo(
    () => overviewPoints(vendors, metric, guests),
    [vendors, metric, guests],
  );
  const values = points.map((point) => point.value);
  const summary = summarizePrices(values);
  const bins = buildPriceHistogram(values, 8);
  const selectedValue = points.find((point) => point.id === selectedId)?.value;
  const unit = isVenue
    ? venueMetric === "meal"
      ? " / 1인"
      : ` / ${guests}명 기준`
    : "";
  return (
    <section className="price-overview" aria-label="검색 결과 가격 인사이트">
      <button
        className="po-heading"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="price-overview-content"
      >
        <span>
          <ChartNoAxesColumnIncreasing size={16} />
          <strong>가격의 흐름을 한눈에</strong>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div id="price-overview-content">
          {isVenue ? (
            <div className="po-metric-tabs" aria-label="분포 가격 기준">
              <button
                aria-pressed={venueMetric === "meal"}
                className={cn(venueMetric === "meal" && "active")}
                onClick={() => setVenueMetric("meal")}
              >
                1인 식대
              </button>
              <button
                aria-pressed={venueMetric === "estimate"}
                className={cn(venueMetric === "estimate" && "active")}
                onClick={() => setVenueMetric("estimate")}
              >
                {guests}명 참고비용
              </button>
            </div>
          ) : (
            options.length > 0 && (
              <label className="po-metric-select">
                같은 상품·단위로
                <select
                  aria-label="가격 분포 상품과 단위"
                  value={metric}
                  onChange={(event) => setPlanningMetric(event.target.value)}
                >
                  {options.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} · {option.count}곳
                    </option>
                  ))}
                </select>
              </label>
            )
          )}
          {summary ? (
            <>
              <div className="po-statistics">
                <div>
                  <span>
                    중앙값<small>{unit}</small>
                  </span>
                  <strong>{money(summary.median)}</strong>
                </div>
                <div>
                  <span>
                    평균<small>{unit}</small>
                  </span>
                  <b>{money(summary.mean)}</b>
                </div>
              </div>
              <EmpiricalHistogram
                bins={bins}
                summary={summary}
                selectedValue={selectedValue}
              />
              <div className="po-middle-range">
                <span>중간 50% 가격대</span>
                <b>
                  {money(summary.q1)} ~ {money(summary.q3)}
                </b>
              </div>
              <p className="po-note">
                현재 검색 결과 중 가격 확인 {summary.count}곳
                {isVenue
                  ? " · 업체별 최저금액 기준"
                  : " · 같은 상품·단위의 최저금액 기준"}
              </p>
              {isVenue && venueMetric === "estimate" && (
                <p className="po-note">
                  홀별 보증인원 반영 · 장식·필수 옵션 등 별도
                </p>
              )}
              {!isVenue && (
                <p className="po-note">
                  상품 구성·성별·적용 기간에 따라 달라질 수 있어요.
                </p>
              )}
            </>
          ) : (
            <p className="po-empty">
              비교할 가격 정보가 아직 없어요.
              <br />
              조건을 넓히거나 다른 업체를 살펴보세요.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
function EmpiricalHistogram({
  bins,
  summary,
  selectedValue,
}: {
  bins: PriceBin[];
  summary: PriceSummary;
  selectedValue?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const lower = bins[0].lower;
  const upper = bins[bins.length - 1].upper;
  const extent = upper - lower || 1;
  const highest = Math.max(1, ...bins.map((bin) => bin.count));
  const position = (value: number) =>
    `${Math.max(1, Math.min(99, ((value - lower) / extent) * 100))}%`;
  const active = hovered != null ? bins[hovered] : null;
  return (
    <div className="po-distribution">
      <div
        className="po-histogram"
        aria-label={`실제 가격 분포, ${summary.count}곳, 평균 ${money(summary.mean)}, 중앙값 ${money(summary.median)}`}
      >
        {bins.map((bin, index) => (
          <button
            key={index}
            className={cn("po-bin", hovered === index && "is-active")}
            aria-label={`${money(bin.lower)}부터 ${money(bin.upper)}까지 ${bin.count}곳`}
            title={`${money(bin.lower)} ~ ${money(bin.upper)} · ${bin.count}곳`}
            onPointerEnter={() => setHovered(index)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
          >
            <span style={{ height: `${(bin.count / highest) * 100}%` }} />
            <i>{bin.count > 0 ? bin.count : ""}</i>
          </button>
        ))}
        <span
          className="po-average-marker"
          style={{ left: position(summary.mean) }}
          aria-hidden="true"
        />
        <span
          className="po-median-marker"
          style={{ left: position(summary.median) }}
          aria-hidden="true"
        />
        {selectedValue != null && (
          <span
            className="po-selected-marker"
            style={{ left: position(selectedValue) }}
            aria-label={`선택 업체 ${money(selectedValue)}`}
          />
        )}
      </div>
      <div className="po-axis">
        <span>{money(summary.min)}</span>
        <span>{money(summary.max)}</span>
      </div>
      <div className="po-chart-legend">
        <span>
          <i className="median" />
          중앙값
        </span>
        <span>
          <i className="mean" />
          평균
        </span>
        {selectedValue != null && (
          <span>
            <i className="selected" />
            선택 업체
          </span>
        )}
      </div>
      <p
        className={cn("po-hover-readout", active && "active")}
        aria-live="polite"
      >
        {active
          ? `${money(active.lower)} ~ ${money(active.upper)} · ${active.count}곳`
          : "막대에 마우스를 올려 가격대를 살펴보세요"}
      </p>
    </div>
  );
}
