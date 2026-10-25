"use client";

import { useState } from "react";
import {
  buildPriceHistogram,
  formatMoney,
  formatWon,
  getPlanningPrices,
  getVenueCostBreakdown,
  planningCategoryLabels,
  summarizePrices,
  type Vendor,
} from "@/entities/vendor";

function amount(value: number) {
  return value === 0 ? "0원" : `${formatMoney(value)}원`;
}

export function VenueCostSplit({
  vendor,
  guests,
}: {
  vendor: Vendor;
  guests: number;
}) {
  const cost = getVenueCostBreakdown(vendor, guests);
  if (!cost) return null;
  const mealPercent = cost.total > 0 ? (cost.meal / cost.total) * 100 : 0;
  const rentalLabel = cost.rentalKind === "combined" ? "대관·장식" : "대관";
  return (
    <div className="vd-cost-visual" aria-label="선택한 하객 수의 비용 구성">
      <div
        className="vd-cost-stack"
        role="img"
        aria-label={`식대 ${formatWon(cost.meal)}, ${rentalLabel} ${cost.rental == null ? "미확인" : formatWon(cost.rental)}. 확인된 합계 ${formatWon(cost.total)}`}
      >
        <span
          className="vd-stack-meal"
          style={{ width: `${cost.total === 0 ? 0 : mealPercent}%` }}
        />
        {cost.rental != null && cost.rental > 0 && (
          <span
            className="vd-stack-rental"
            style={{ width: `${100 - mealPercent}%` }}
          />
        )}
      </div>
      <div className="vd-cost-split-labels">
        <span>
          <i className="vd-dot-meal" />
          식대 <b>{amount(cost.meal)}</b>
        </span>
        <span>
          <i className="vd-dot-rental" />
          {rentalLabel}{" "}
          <b>{cost.rental == null ? "미확인" : amount(cost.rental)}</b>
        </span>
      </div>
    </div>
  );
}

export function GuestCostTrend({
  vendor,
  guests,
}: {
  vendor: Vendor;
  guests: number;
}) {
  const [focusedGuests, setFocusedGuests] = useState<number | null>(null);
  const counts = [...new Set([100, 150, 200, 250, 300, 400, guests])].sort(
    (a, b) => a - b,
  );
  const points = counts.map((count) => ({
    guests: count,
    cost: getVenueCostBreakdown(vendor, count),
  }));
  const available = points.filter((point) => point.cost != null);
  if (available.length < 2) return null;
  const maximum = Math.max(...available.map((point) => point.cost!.total), 0);
  const current =
    available.find((point) => point.guests === focusedGuests) ??
    available.find((point) => point.guests === guests) ??
    available[0];
  const x = (count: number) =>
    18 + ((count - counts[0]) / (counts[counts.length - 1] - counts[0])) * 264;
  const labelCounts = new Set([counts[0], counts[counts.length - 1], guests]);
  for (const count of counts) {
    if ([...labelCounts].every((label) => Math.abs(x(label) - x(count)) >= 29))
      labelCounts.add(count);
  }
  const y = (total: number) => 112 - (total / Math.max(maximum, 1)) * 76;
  const path = points
    .map((point, index) =>
      point.cost
        ? `${index === 0 || points[index - 1].cost == null ? "M" : "L"}${x(point.guests)},${y(point.cost.total)}`
        : "",
    )
    .filter(Boolean)
    .join(" ");
  return (
    <section
      className="vd-section vd-guest-trend"
      aria-label="하객 수별 비용 변화"
    >
      <div className="vd-section-heading">
        <h3>하객 수가 달라지면</h3>
        <span>공개비용 참고액</span>
      </div>
      <div className="vd-trend-readout" aria-live="polite">
        <span>
          하객 <b>{current.guests}명</b>
        </span>
        <strong>{amount(current.cost!.total)}</strong>
        {current.cost!.billableGuests > current.guests && (
          <small>보증 {current.cost!.billableGuests}명 적용</small>
        )}
      </div>
      <svg
        viewBox="0 0 300 141"
        role="group"
        aria-label="하객 인원별 참고비용 그래프. 점에 마우스를 올리거나 키보드로 이동하면 금액을 확인할 수 있습니다."
        className="vd-trend-chart"
        onMouseLeave={() => setFocusedGuests(null)}
      >
        <line x1="14" y1="112" x2="288" y2="112" stroke="var(--orot-border)" />
        <line
          x1="14"
          y1="36"
          x2="288"
          y2="36"
          stroke="var(--orot-surface-muted)"
          strokeDasharray="3 4"
        />
        <text x="14" y="20" className="vd-chart-axis">
          {amount(maximum)}
        </text>
        <text x="14" y="126" className="vd-chart-zero">
          0
        </text>
        <path
          d={path}
          fill="none"
          stroke="var(--orot-muted)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {points.map((point) =>
          point.cost ? (
            <g
              key={point.guests}
              tabIndex={0}
              role="button"
              aria-label={`하객 ${point.guests}명, ${formatWon(point.cost.total)}${point.cost.billableGuests > point.guests ? `, 보증 ${point.cost.billableGuests}명 적용` : ""}`}
              aria-pressed={current.guests === point.guests}
              onMouseEnter={() => setFocusedGuests(point.guests)}
              onFocus={() => setFocusedGuests(point.guests)}
              onClick={() => setFocusedGuests(point.guests)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setFocusedGuests(point.guests);
                }
              }}
            >
              <rect
                x={x(point.guests) - 12}
                y="25"
                width="24"
                height="116"
                fill="transparent"
              />
              <circle
                cx={x(point.guests)}
                cy={y(point.cost.total)}
                r="12"
                fill="transparent"
              />
              {current.guests === point.guests && (
                <circle
                  cx={x(point.guests)}
                  cy={y(point.cost.total)}
                  r="8"
                  fill="var(--orot-border)"
                />
              )}
              <circle
                cx={x(point.guests)}
                cy={y(point.cost.total)}
                r={current.guests === point.guests ? 4 : 3}
                fill={
                  current.guests === point.guests
                    ? "var(--orot-primary)"
                    : "var(--orot-surface)"
                }
                stroke="var(--orot-muted)"
                strokeWidth="1.5"
              />
              {labelCounts.has(point.guests) && (
                <text
                  x={x(point.guests)}
                  y="139"
                  textAnchor="middle"
                  className={
                    point.guests === guests
                      ? "vd-chart-axis is-current"
                      : "vd-chart-axis"
                  }
                >
                  {point.guests}
                </text>
              )}
            </g>
          ) : labelCounts.has(point.guests) ? (
            <text
              key={point.guests}
              x={x(point.guests)}
              y="139"
              textAnchor="middle"
              className="vd-chart-axis"
            >
              {point.guests}
            </text>
          ) : null,
        )}
      </svg>
      <p className="vd-note">
        각 인원에 맞는 홀·보증 조건 중 가장 낮은 참고액입니다. 점마다 적용
        조건이 달라질 수 있으며, 미확인 추가 비용은 별도예요.
      </p>
    </section>
  );
}

export function PriceDistribution({
  vendor,
  vendors,
}: {
  vendor: Vendor;
  vendors: Vendor[];
}) {
  const [focusedBin, setFocusedBin] = useState<number | null>(null);
  if (vendor.kind !== "venue" || vendor.mealMin == null) return null;
  const prices = vendors
    .filter(
      (item) =>
        item.kind === "venue" &&
        item.region === vendor.region &&
        item.priceYear === vendor.priceYear &&
        item.archived === vendor.archived &&
        item.mealMin != null,
    )
    .map((item) => item.mealMin!);
  const stats = summarizePrices(prices);
  if (!stats || stats.count < 2)
    return (
      <p className="vd-note">
        같은 지역·적용연도에 비교할 수 있는 식대가 더 모이면 가격 분포를
        보여드릴게요.
      </p>
    );
  const bins = buildPriceHistogram(prices, 10);
  const lower = bins[0].lower;
  const upper = bins[bins.length - 1].upper;
  const position = (value: number) => ((value - lower) / (upper - lower)) * 100;
  const highest = Math.max(...bins.map((bin) => bin.count), 1);
  const difference =
    stats.mean === 0
      ? 0
      : Math.round(Math.abs(vendor.mealMin / stats.mean - 1) * 100);
  const active = focusedBin == null ? null : bins[focusedBin];
  return (
    <section
      className="vd-section vd-distribution"
      aria-label="지역 식대 가격 분포"
    >
      <div className="vd-section-heading">
        <h3>이 지역의 가격 속에서</h3>
        <span>{stats.count}개 표본</span>
      </div>
      <p className="vd-chart-insight">
        평균보다{" "}
        <strong>
          {difference}% {vendor.mealMin <= stats.mean ? "낮아요" : "높아요"}
        </strong>
      </p>
      <div
        className="vd-histogram"
        role="group"
        aria-label={`같은 지역 1인 식대 실제 분포. 평균 ${formatWon(stats.mean)}, 중앙값 ${formatWon(stats.median)}, 이 업체 ${formatWon(vendor.mealMin)}`}
        onMouseLeave={() => setFocusedBin(null)}
      >
        <div className="vd-hist-bars">
          {bins.map((bin, index) => (
            <button
              key={index}
              type="button"
              className={`vd-hist-bin ${focusedBin === index ? "is-active" : ""}`}
              onMouseEnter={() => setFocusedBin(index)}
              onFocus={() => setFocusedBin(index)}
              onClick={() => setFocusedBin(index)}
              aria-label={`${formatWon(Math.round(bin.lower))}에서 ${formatWon(Math.round(bin.upper))} 구간, ${bin.count}곳`}
            >
              <span
                style={{
                  height: `${(bin.count / highest) * 100}%`,
                  minHeight: bin.count > 0 ? 1 : 0,
                }}
              />
            </button>
          ))}
        </div>
        <div
          className="vd-hist-marker vd-hist-mean"
          style={{ left: `${position(stats.mean)}%` }}
          aria-hidden="true"
        >
          <i />
        </div>
        <div
          className="vd-hist-marker vd-hist-median"
          style={{ left: `${position(stats.median)}%` }}
          aria-hidden="true"
        >
          <i />
        </div>
        <div
          className="vd-hist-marker vd-hist-selected"
          style={{ left: `${position(vendor.mealMin)}%` }}
          aria-hidden="true"
        >
          <i />
        </div>
      </div>
      <div className="vd-hist-axis">
        <span>{amount(stats.min)}</span>
        <span>{amount(stats.max)}</span>
      </div>
      <div className="vd-hist-readout" role="status">
        {active ? (
          <>
            <span>
              {amount(Math.round(active.lower))} ~{" "}
              {amount(Math.round(active.upper))}
            </span>
            <b>{active.count}곳</b>
          </>
        ) : (
          <>
            <span>가격대를 누르면 업체 수를 볼 수 있어요</span>
            <b>1인 식대</b>
          </>
        )}
      </div>
      <dl className="vd-distribution-stats">
        <div>
          <dt>
            <i className="vd-key-selected" />이 업체
          </dt>
          <dd>{amount(vendor.mealMin)}</dd>
        </div>
        <div>
          <dt>
            <i className="vd-key-mean" />
            지역 평균
          </dt>
          <dd>{amount(stats.mean)}</dd>
        </div>
        <div>
          <dt>
            <i className="vd-key-median" />
            중앙값
          </dt>
          <dd>{amount(stats.median)}</dd>
        </div>
      </dl>
      <p className="vd-note">
        {vendor.region} · 적용연도 {vendor.priceYear ?? "미기재"} · 업체별 최저
        성인 식대 기준. 평균과의 차이는 할인율이 아닙니다.
      </p>
    </section>
  );
}

export function PlanningPriceChart({ vendor }: { vendor: Vendor }) {
  const groups = getPlanningPrices(vendor);
  if (!groups.length) return null;
  return (
    <section
      className="vd-section vd-planning-chart"
      aria-label="준비대행 상품별 가격 범위"
    >
      <div className="vd-section-heading">
        <h3>상품별 가격 범위</h3>
        <span>분류·단위별로</span>
      </div>
      <div className="vd-planning-price-list">
        {groups.map((group) => {
          const max = group.max ?? group.min;
          const minimum = group.min;
          const ratio =
            minimum != null && max != null && max > 0
              ? (minimum / max) * 100
              : 0;
          return (
            <div
              className="vd-planning-range"
              key={`${group.category}:${group.basis}`}
            >
              <div className="vd-planning-range-title">
                <span>{planningCategoryLabels[group.category]}</span>
                <small>{group.unitLabel}</small>
              </div>
              {minimum != null && max != null ? (
                <>
                  <strong>
                    {amount(minimum)}
                    {minimum !== max ? ` ~ ${amount(max)}` : ""}
                  </strong>
                  <div
                    className="vd-planning-range-track"
                    role="img"
                    aria-label={`${planningCategoryLabels[group.category]}, ${group.unitLabel}, 최저 ${formatWon(minimum)}, 최고 ${formatWon(max)}`}
                  >
                    <span
                      style={{
                        left: `${ratio}%`,
                        width: `${minimum === max ? 0 : 100 - ratio}%`,
                      }}
                    />
                    <i style={{ left: `${ratio}%` }} />
                    <i
                      className="is-max"
                      style={{ left: max === 0 ? "0%" : "100%" }}
                    />
                  </div>
                </>
              ) : (
                <p className="vd-note">유료 기본가 미확인</p>
              )}
              {(group.freeAvailable || group.includedAvailable) && (
                <p className="vd-note">
                  {[
                    group.freeAvailable ? "조건별 무료 항목 있음" : "",
                    group.includedAvailable
                      ? "다른 상품에 포함된 항목 있음"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="vd-note">
        각 행은 별도 가격 범위입니다. 서로 다른 상품·인원 단위를 더한 스드메
        총액이 아니에요.
      </p>
    </section>
  );
}
