import { ChartNoAxesCombined, ChartNoAxesColumnIncreasing } from "lucide-react";
import type { PlanningPriceSummary, Vendor } from "@/entities/vendor";
import {
  formatMoney,
  getPlanningPrices,
  getVenueCostBreakdown,
  planningCategoryLabels,
  planningServiceCategories,
} from "@/entities/vendor";

function chartMoney(value: number) {
  return value === 0 ? "0원" : `${formatMoney(value)}원`;
}

function ChartAxis({ maximum }: { maximum: number }) {
  return (
    <div className="vc-chart-axis" aria-hidden="true">
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <span key={fraction}>{chartMoney(maximum * fraction)}</span>
      ))}
    </div>
  );
}

export function VenueComparisonChart({
  vendors,
  guests,
}: {
  vendors: Vendor[];
  guests: number;
}) {
  const entries = vendors.map((vendor) => ({
    vendor,
    cost: getVenueCostBreakdown(vendor, guests),
  }));
  const maximum = Math.max(...entries.map(({ cost }) => cost?.total ?? 0), 1);
  const hasKnownPrice = entries.some(
    ({ cost }) => cost != null && cost.total > 0,
  );
  return (
    <section
      className="vc-visual-section vc-cost-chart"
      aria-label="웨딩홀 비용 구성 그래프"
    >
      <div className="vc-visual-heading">
        <div>
          <span className="vc-visual-eyebrow">THE PRICE, AT A GLANCE</span>
          <h3>공개비용의 차이를 한눈에</h3>
        </div>
        <ChartNoAxesCombined size={23} strokeWidth={1.2} aria-hidden="true" />
      </div>
      <p className="vc-visual-description">
        하객 {guests.toLocaleString("ko-KR")}명과 각 홀의 보증인원을 반영했어요.
      </p>
      <div className="vc-chart-legend">
        <span>
          <i className="vc-swatch-meal" />
          식대
        </span>
        <span>
          <i className="vc-swatch-rental" />
          대관 / 대관·장식
        </span>
      </div>
      <div className="vc-cost-rows">
        {entries.map(({ vendor, cost }, index) => (
          <div className="vc-cost-row" key={vendor.id}>
            <div className="vc-cost-row-heading">
              <span className="vc-chart-number">0{index + 1}</span>
              <strong>{vendor.name}</strong>
              <span className="vc-chart-total">
                {cost == null ? "가격 정보 없음" : chartMoney(cost.total)}
                {cost?.rental === null && <small>식대만</small>}
              </span>
            </div>
            {cost ? (
              <>
                <div
                  className="vc-stacked-track"
                  role="img"
                  tabIndex={0}
                  aria-label={`${vendor.name}: 식대 ${chartMoney(cost.meal)}, ${cost.rental == null ? "대관료 미확인" : `${cost.rentalKind === "combined" ? "대관·장식" : "대관료"} ${chartMoney(cost.rental)}`}, ${cost.rental == null ? "확인된 식대 합계" : "공개비용 합계"} ${chartMoney(cost.total)}, 적용 인원 ${cost.billableGuests}명`}
                >
                  <div
                    className="vc-stacked-fill"
                    style={{ width: `${(cost.total / maximum) * 100}%` }}
                    aria-hidden="true"
                  >
                    <span
                      className="vc-meal-segment"
                      style={{
                        width: `${cost.total > 0 ? (cost.meal / cost.total) * 100 : 0}%`,
                      }}
                      title={`식대 ${chartMoney(cost.meal)}`}
                    />
                    {cost.rental != null && (
                      <span
                        className="vc-rental-segment"
                        style={{
                          width: `${cost.total > 0 ? (cost.rental / cost.total) * 100 : 0}%`,
                        }}
                        title={`${cost.rentalKind === "combined" ? "대관·장식" : "대관료"} ${chartMoney(cost.rental)}`}
                      />
                    )}
                  </div>
                </div>
                <div className="vc-cost-row-details">
                  <span>
                    식대 {chartMoney(cost.meal)} <b>＋</b>{" "}
                    {cost.rental == null ? (
                      <em>대관료 미확인</em>
                    ) : (
                      `${cost.rentalKind === "combined" ? "대관·장식" : "대관료"} ${chartMoney(cost.rental)}`
                    )}
                  </span>
                  <span>
                    {cost.billableGuests > guests
                      ? `보증인원 ${cost.billableGuests}명 적용`
                      : `${cost.billableGuests}명 적용`}
                  </span>
                </div>
              </>
            ) : (
              <div className="vc-chart-unavailable">
                비용이 제공되면 같은 기준으로 비교할 수 있어요.
              </div>
            )}
          </div>
        ))}
      </div>
      {hasKnownPrice && <ChartAxis maximum={maximum} />}
      <p className="vc-chart-note">
        같은 홀·조건의 최저 참고액이에요. 미확인 비용은 0원으로 보지 않으며,
        미확인 장식·필수 옵션 등 추가 비용은 별도입니다.
      </p>
    </section>
  );
}

interface PlanningChartGroup {
  category: PlanningPriceSummary["category"];
  basis: PlanningPriceSummary["basis"];
  unitLabel: string;
}

function planningChartGroups(vendors: Vendor[]): PlanningChartGroup[] {
  const groups = new Map<string, PlanningChartGroup>();
  for (const vendor of vendors) {
    for (const price of getPlanningPrices(vendor)) {
      groups.set(`${price.category}:${price.basis}`, {
        category: price.category,
        basis: price.basis,
        unitLabel: price.unitLabel,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      planningServiceCategories.indexOf(a.category) -
        planningServiceCategories.indexOf(b.category) ||
      a.basis.localeCompare(b.basis),
  );
}

function PlanningPriceBar({
  vendor,
  price,
  maximum,
  index,
}: {
  vendor: Vendor;
  price: PlanningPriceSummary | undefined;
  maximum: number;
  index: number;
}) {
  const numeric = price?.min != null;
  return (
    <div className="vc-planning-chart-row">
      <div className="vc-planning-row-heading">
        <span>
          <i style={{ background: `var(--vc-vendor-${index})` }} />
          {vendor.name}
        </span>
        <strong>
          {numeric ? chartMoney(price.min!) : "유료 가격 정보 없음"}
        </strong>
      </div>
      {numeric ? (
        <div
          className="vc-planning-track"
          role="img"
          tabIndex={0}
          aria-label={`${vendor.name}: ${planningCategoryLabels[price.category]} ${price.unitLabel}, 최저 ${chartMoney(price.min!)}${price.max != null && price.max !== price.min ? `, 최고 ${chartMoney(price.max)}` : ""}`}
        >
          <div
            className="vc-planning-range"
            style={{
              width: `${((price.max ?? price.min!) / maximum) * 100}%`,
              color: `var(--vc-vendor-${index})`,
            }}
            aria-hidden="true"
          >
            <span
              style={{
                width: `${(price.max ?? price.min!) > 0 ? (price.min! / (price.max ?? price.min!)) * 100 : 0}%`,
              }}
            />
          </div>
          {price.max != null && price.max !== price.min && (
            <span className="vc-planning-range-label">
              ~ {chartMoney(price.max)}
            </span>
          )}
        </div>
      ) : (
        <div className="vc-planning-no-price" aria-hidden="true" />
      )}
      {(price?.freeAvailable || price?.includedAvailable) && (
        <p className="vc-planning-price-state">
          {[
            price.freeAvailable ? "조건별 무료 항목 있음" : "",
            price.includedAvailable ? "다른 상품에 포함된 항목 있음" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function PlanningCategoryChart({
  vendors,
  group,
}: {
  vendors: Vendor[];
  group: PlanningChartGroup;
}) {
  const entries = vendors.map((vendor) => ({
    vendor,
    price: getPlanningPrices(vendor).find(
      (price) =>
        price.category === group.category && price.basis === group.basis,
    ),
  }));
  const maximum = Math.max(
    ...entries.map(({ price }) => price?.max ?? price?.min ?? 0),
    1,
  );
  return (
    <section
      className="vc-planning-category-chart"
      aria-label={`${planningCategoryLabels[group.category]} ${group.unitLabel} 가격 그래프`}
    >
      <div className="vc-planning-category-heading">
        <h4>{planningCategoryLabels[group.category]}</h4>
        <span>{group.unitLabel}</span>
      </div>
      {entries.map(({ vendor, price }, index) => (
        <PlanningPriceBar
          key={vendor.id}
          vendor={vendor}
          price={price}
          maximum={maximum}
          index={index}
        />
      ))}
    </section>
  );
}

export function PlanningComparisonCharts({ vendors }: { vendors: Vendor[] }) {
  const groups = planningChartGroups(vendors);
  if (!groups.length) return null;
  return (
    <section
      className="vc-visual-section vc-planning-visual"
      aria-label="준비대행 상품별 가격 비교 그래프"
    >
      <div className="vc-visual-heading">
        <div>
          <span className="vc-visual-eyebrow">COMPARE LIKE WITH LIKE</span>
          <h3>같은 상품, 같은 단위끼리</h3>
        </div>
        <ChartNoAxesColumnIncreasing
          size={23}
          strokeWidth={1.2}
          aria-hidden="true"
        />
      </div>
      <p className="vc-visual-description">
        막대의 진한 부분은 최저가, 연한 부분은 최고가까지의 범위예요.
      </p>
      <div className="vc-planning-charts-grid">
        {groups.map((group) => (
          <PlanningCategoryChart
            key={`${group.category}:${group.basis}`}
            vendors={vendors}
            group={group}
          />
        ))}
      </div>
      <p className="vc-chart-note">
        상품·1인·패키지는 각각 다른 척도로 표시해요. 무료·포함 항목은 유료
        기본가와 나누며, 상품을 합산하지 않습니다.
      </p>
    </section>
  );
}
