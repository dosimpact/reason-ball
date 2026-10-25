"use client";

import {
  ArrowDownToLine,
  Check,
  FileText,
  Scale,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  PlanningPriceSummary,
  PlanningServiceCategory,
  Vendor,
  VendorKind,
} from "@/entities/vendor";
import {
  estimatedVenueCost,
  formatMoney,
  getPlanningPrices,
  getPlanningPriceCaption,
  planningCategoryLabels,
  planningServiceCategories,
} from "@/entities/vendor";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  PlanningComparisonCharts,
  VenueComparisonChart,
} from "./comparison-charts";
import "./comparison.css";

interface VendorComparisonProps {
  vendors: Vendor[];
  guests: number;
  onRemove: (id: string) => void;
  onClose: () => void;
  onGuestsChange?: (guests: number) => void;
}

function rangeText(minimum: number | null, maximum: number | null) {
  if (minimum == null) return "가격 정보 없음";
  if (minimum === 0 && (maximum == null || maximum === 0)) return "무료";
  return `${minimum === 0 ? "0" : formatMoney(minimum)}${maximum != null && maximum !== minimum ? ` ~ ${formatMoney(maximum)}` : ""}원`;
}

function planningGroupText(group: PlanningPriceSummary): string {
  const numeric =
    group.min == null
      ? "유료 공시가 미확인"
      : group.min === 0 && group.max === 0
        ? "0원"
        : rangeText(group.min, group.max);
  const states = [
    group.freeAvailable ? "조건별 무료 항목 있음" : "",
    group.includedAvailable ? "다른 상품에 포함된 항목 있음" : "",
  ].filter(Boolean);
  return `${numeric} / ${group.unitLabel}${states.length ? ` · ${states.join(" · ")}` : ""}`;
}

function planningCategoryText(
  vendor: Vendor,
  category: PlanningServiceCategory,
): string {
  return (
    getPlanningPrices(vendor)
      .filter((group) => group.category === category)
      .map(planningGroupText)
      .join(" | ") || "가격 정보 없음"
  );
}

function PlanningCategoryPrice({
  vendor,
  category,
}: {
  vendor: Vendor;
  category: PlanningServiceCategory;
}) {
  const groups = getPlanningPrices(vendor).filter(
    (group) => group.category === category,
  );
  if (!groups.length) return <>가격 정보 없음</>;
  return (
    <div className="vc-service-prices">
      {groups.map((group) => (
        <div key={group.basis}>
          <span className="vc-service-unit">{group.unitLabel}</span>
          <span>
            {group.min == null
              ? "유료 공시가 미확인"
              : group.min === 0 && group.max === 0
                ? "0원"
                : rangeText(group.min, group.max)}
          </span>
          {group.freeAvailable && <small>조건별 무료 항목 있음</small>}
          {group.includedAvailable && (
            <small>다른 상품에 포함된 항목 있음</small>
          )}
        </div>
      ))}
    </div>
  );
}

function exportComparison(vendors: Vendor[], guests: number) {
  const rows = [
    [
      "업체명",
      "분류",
      "지역",
      "하객수",
      "최소보증인원",
      "성인1인식대최저(원)",
      "대관료최저(원)",
      "공시식대대관참고액최저(원)",
      "공시식대대관참고액최고(원)",
      "패키지최저(원)",
      "개별기본상품최저(원)",
      "개별기본상품최저의기준",
      ...planningServiceCategories.map(
        (category) => `${planningCategoryLabels[category]} 공시가와단위`,
      ),
      "적용연도",
      "주소",
      "안내",
    ],
    ...vendors.map((vendor) => {
      const estimate = estimatedVenueCost(vendor, guests);
      return [
        vendor.name,
        vendor.kind === "venue" ? "웨딩홀" : "결혼준비대행",
        vendor.region,
        vendor.kind === "venue" ? guests : "",
        vendor.guestsMin ?? "",
        vendor.mealMin ?? "",
        vendor.rentalMin ?? "",
        estimate?.min ?? "",
        estimate?.max ?? "",
        vendor.packageMin ?? "",
        vendor.serviceMin ?? "",
        vendor.kind === "planning" && vendor.serviceMin != null
          ? getPlanningPriceCaption({ ...vendor, packageMin: null })
          : "",
        ...planningServiceCategories.map((category) =>
          vendor.kind === "planning"
            ? planningCategoryText(vendor, category)
            : "",
        ),
        vendor.priceYear ?? "미기재",
        vendor.address ?? "",
        "공시 기준 참고값. 장식과 필수 옵션 별도. 개별상품은 스드메 합계가 아님.",
      ];
    }),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = vendors.some((vendor) => vendor.kind === "venue")
    ? `오롯_웨딩비교_${guests}명.csv`
    : "오롯_웨딩준비_비교.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ComparisonRow = {
  label: string;
  render: (vendor: Vendor) => ReactNode;
  className?: string;
};

function comparisonRows(kind: VendorKind, guests: number): ComparisonRow[] {
  const shared: ComparisonRow[] = [
    { label: "지역", render: (vendor) => vendor.region },
    {
      label: "가격 적용연도",
      render: (vendor) =>
        vendor.priceYear ? `${vendor.priceYear}년` : "적용연도 미제공",
    },
  ];
  if (kind === "planning")
    return [
      ...planningServiceCategories.map((category) => ({
        label:
          category === "package"
            ? "공시 패키지"
            : `${planningCategoryLabels[category]}${category === "other" ? "" : " 기본상품"}`,
        render: (vendor: Vendor) => (
          <PlanningCategoryPrice vendor={vendor} category={category} />
        ),
        className: category === "package" ? "vc-price-row" : undefined,
      })),
      {
        label: "공시 서비스",
        render: (vendor) =>
          vendor.categories
            .map(
              (category) =>
                ({
                  studio: "스튜디오",
                  dress: "드레스",
                  makeup: "메이크업",
                  package: "패키지",
                  other: "기타",
                  meal: "식대",
                  rental: "대관",
                  decoration: "장식",
                })[category],
            )
            .join(" · ") || "상품 구성 확인 필요",
      },
      ...shared,
    ];
  return [
    {
      label: `${guests}명 기준 참고액`,
      render: (vendor) => {
        const estimate = estimatedVenueCost(vendor, guests);
        return rangeText(estimate?.min ?? null, estimate?.max ?? null);
      },
      className: "vc-price-row",
    },
    {
      label: "성인 1인 식대",
      render: (vendor) => rangeText(vendor.mealMin, vendor.mealMax),
    },
    {
      label: "공시 대관료 최저",
      render: (vendor) =>
        vendor.rentalMin == null
          ? "가격 정보 없음"
          : vendor.rentalMin === 0
            ? "무료"
            : `${formatMoney(vendor.rentalMin)}원`,
    },
    {
      label: "최소 보증 인원",
      render: (vendor) =>
        vendor.guestsMin == null
          ? "가격 정보 없음"
          : `${vendor.guestsMin.toLocaleString("ko-KR")}명`,
    },
    {
      label: "계산에 적용한 인원",
      render: (vendor) => {
        const estimate = estimatedVenueCost(vendor, guests);
        return estimate == null ? (
          "계산 불가"
        ) : (
          <>
            {estimate.billableGuests}명
            {estimate.billableGuests > guests && (
              <small className="vc-guarantee">보증 인원 적용</small>
            )}
          </>
        );
      },
    },
    {
      label: "참고액의 포함 범위",
      render: (vendor) =>
        estimatedVenueCost(vendor, guests)?.notes[0] || "가격 정보 없음",
    },
    ...shared,
  ];
}

function ComparisonTable({
  vendors,
  kind,
  guests,
  onRemove,
}: {
  vendors: Vendor[];
  kind: VendorKind;
  guests: number;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="vc-group">
      <div className="vc-group-heading">
        <span>
          {kind === "venue" ? "01 / VENUES" : "02 / WEDDING PARTNERS"}
        </span>
        <h3>{kind === "venue" ? "웨딩홀 비교" : "결혼준비대행 비교"}</h3>
      </div>
      {kind === "venue" ? (
        <VenueComparisonChart vendors={vendors} guests={guests} />
      ) : (
        <PlanningComparisonCharts vendors={vendors} />
      )}
      <details className="vc-table-details" open>
        <summary>항목별로 자세히 비교하기</summary>
        <div className="vc-table-wrap">
          <table className="vc-table">
            <thead>
              <tr>
                <th scope="col">
                  <Scale size={20} />
                  <span>
                    같은 기준으로
                    <br />
                    꼼꼼하게
                  </span>
                </th>
                {vendors.map((vendor) => (
                  <th scope="col" key={vendor.id}>
                    <div className="vc-vendor-heading">
                      <span>{vendor.region}</span>
                      <button
                        onClick={() => onRemove(vendor.id)}
                        type="button"
                        aria-label={`${vendor.name} 비교에서 제거`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <h4>{vendor.name}</h4>
                    <span className="vc-kind-tag">
                      {kind === "venue" ? "웨딩홀" : "결혼준비대행"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows(kind, guests).map((row) => (
                <tr key={row.label} className={row.className}>
                  <th scope="row">{row.label}</th>
                  {vendors.map((vendor) => (
                    <td key={vendor.id}>{row.render(vendor)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="vc-group-note">
        {kind === "venue"
          ? "참고액은 동일한 홀·조건 안에서 식대 × 적용 인원 + 공개 대관료를 계산한 값입니다. 미확인 대관료·장식·필수 옵션은 포함되지 않으며 확정 견적이 아닙니다. 식대·대관료 각 최저값과 계산에 선택한 조건은 다를 수 있습니다."
          : "스튜디오·드레스·메이크업·패키지를 각각 비교하며 합산하지 않습니다. 같은 분류라도 1인/상품 단위·성별·구성이 다를 수 있으므로 표시된 단위와 적용 조건을 확인해주세요. 무료·포함 항목은 유료 기본가와 구분합니다. 패키지의 촬영·의상·메이크업 구성, 적용 기간, 추가 옵션을 함께 살펴보세요."}
      </p>
    </section>
  );
}

export function VendorComparison({
  vendors,
  guests,
  onRemove,
  onClose,
  onGuestsChange,
}: VendorComparisonProps) {
  const venues = vendors.filter((vendor) => vendor.kind === "venue");
  const planners = vendors.filter((vendor) => vendor.kind === "planning");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="vendor-comparison"
        aria-describedby="comparison-description"
      >
        <DialogHeader className="vc-header">
          <div className="vc-eyebrow">A THOUGHTFUL CHOICE</div>
          <DialogTitle className="vc-title">우리의 선택을, 나란히.</DialogTitle>
          <DialogDescription
            id="comparison-description"
            className="vc-description"
          >
            마음에 담은 업체 {vendors.length}곳을 같은 기준으로 살펴보세요.
          </DialogDescription>
        </DialogHeader>
        {vendors.length > 0 && (
          <div className="vc-controls">
            {venues.length > 0 && (
              <div className="vc-guests">
                <Users size={16} />
                <label htmlFor="comparison-guests">예상 하객</label>
                {onGuestsChange ? (
                  <input
                    id="comparison-guests"
                    type="number"
                    min={1}
                    max={2000}
                    step={10}
                    value={guests}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next) && next >= 1 && next <= 2000)
                        onGuestsChange(next);
                    }}
                  />
                ) : (
                  <span>{guests}</span>
                )}
                <span>명</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportComparison(vendors, guests)}
            >
              <ArrowDownToLine size={14} />
              비교표 저장
            </Button>
          </div>
        )}
        <div className="vc-scroll">
          {vendors.length === 0 ? (
            <div className="vc-empty">
              <Scale size={36} strokeWidth={1} />
              <h3>비교할 업체를 담아주세요</h3>
              <p>
                목록이나 상세 화면에서 비교함에 최대 3곳까지 담을 수 있어요.
              </p>
              <Button onClick={onClose}>업체 둘러보기</Button>
            </div>
          ) : (
            <>
              {venues.length > 0 && planners.length > 0 && (
                <p className="vc-mixed-note">
                  <FileText size={15} />
                  웨딩홀과 준비대행은 비용의 기준이 달라 각각 비교합니다.
                </p>
              )}
              {venues.length > 0 && (
                <ComparisonTable
                  vendors={venues}
                  kind="venue"
                  guests={guests}
                  onRemove={onRemove}
                />
              )}
              {planners.length > 0 && (
                <ComparisonTable
                  vendors={planners}
                  kind="planning"
                  guests={guests}
                  onRemove={onRemove}
                />
              )}
              <div className="vc-checklist">
                <h3>
                  <Check size={15} />
                  계약 전, 함께 확인해보세요
                </h3>
                <ul>
                  <li>원하는 예식일·시간대에 적용되는 가격인가요?</li>
                  <li>보증 인원, 필수 옵션, 부가세·봉사료를 확인했나요?</li>
                  <li>패키지 포함 항목과 취소·환급 조건을 비교했나요?</li>
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="vc-footer">
          <span>같은 조건으로 비교하는, 우리다운 선택</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            계속 둘러보기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
