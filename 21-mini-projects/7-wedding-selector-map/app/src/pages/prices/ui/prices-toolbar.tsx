import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/shared/ui/dialog";
import { useState } from "react";
import {
  Check,
  X,
  ChevronDown,
  Heart,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
  MapPin,
  Flower2,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { money } from "@/shared/lib/format";
import type { PriceBrowserProps } from "../model/use-price-browser";
type Props = PriceBrowserProps<
  | "filters"
  | "updateFilters"
  | "changeKind"
  | "regions"
  | "years"
  | "planningOptions"
  | "resetFilters"
  | "activeFilters"
  | "isPending"
  | "summary"
  | "metricLabel"
>;
export function PricesToolbar({
  filters,
  updateFilters,
  changeKind,
  regions,
  years,
  planningOptions,
  resetFilters,
  activeFilters,
  isPending,
  summary,
  metricLabel,
}: Props) {
  const conditions = [
    ...filters.regions.map((region) => ({
      key: `region:${region}`,
      label: region,
      clear: () =>
        updateFilters({
          regions: filters.regions.filter((value) => value !== region),
        }),
    })),
    ...(filters.query
      ? [
          {
            key: "query",
            label: `검색: ${filters.query}`,
            clear: () => updateFilters({ query: "" }),
          },
        ]
      : []),
    ...(filters.budget > 0
      ? [
          {
            key: "budget",
            label: `${money(filters.budget)} 이하`,
            clear: () => updateFilters({ budget: 0 }),
          },
        ]
      : []),
    ...(filters.year !== "all"
      ? [
          {
            key: "year",
            label:
              filters.year === "unknown" ? "연도 미기재" : `${filters.year}년`,
            clear: () => updateFilters({ year: "all" }),
          },
        ]
      : []),
    ...(filters.onlyPriced
      ? [
          {
            key: "priced",
            label: "가격 확인 업체",
            clear: () => updateFilters({ onlyPriced: false }),
          },
        ]
      : []),
    ...(filters.savedOnly
      ? [
          {
            key: "saved",
            label: "저장한 업체",
            clear: () => updateFilters({ savedOnly: false }),
          },
        ]
      : []),
  ];
  function toggleRegion(region: string) {
    updateFilters({
      regions: filters.regions.includes(region)
        ? filters.regions.filter((value) => value !== region)
        : [...filters.regions, region],
    });
  }
  return (
    <Dialog>
      <section className="prices-compact-toolbar" aria-label="가격표 검색 조건">
        <div className="prices-compact-row">
          <div
            className="prices-kind-tabs"
            role="tablist"
            aria-label="가격표 업체 종류"
          >
            <button
              role="tab"
              aria-selected={filters.kind === "venue"}
              className={cn(filters.kind === "venue" && "active")}
              onClick={() => changeKind("venue")}
            >
              <MapPin size={15} />
              웨딩홀
            </button>
            <button
              role="tab"
              aria-selected={filters.kind === "planning"}
              className={cn(filters.kind === "planning" && "active")}
              onClick={() => changeKind("planning")}
            >
              <Flower2 size={16} />
              스드메 · 플래닝
            </button>
          </div>
          <select
            className="prices-kind-select"
            aria-label="가격표 업체 종류 선택"
            value={filters.kind}
            onChange={(event) =>
              changeKind(event.target.value as "venue" | "planning")
            }
          >
            <option value="venue">웨딩홀</option>
            <option value="planning">스드메</option>
          </select>
          <div className="prices-search">
            <Search size={17} />
            <input
              aria-label="가격표 업체 검색"
              placeholder="업체명, 지역으로 검색"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
            />
            {isPending && <i />}
          </div>
          <DialogTrigger asChild>
            <button className="prices-filter-trigger">
              <SlidersHorizontal size={16} />
              필터{conditions.length > 0 && <b>{conditions.length}</b>}
            </button>
          </DialogTrigger>
        </div>
        <div className="prices-filter-chips" aria-label="적용 중인 조건">
          <DialogTrigger asChild>
            <button className="prices-basis-chip" title="비교 기준 변경">
              {metricLabel}
              <ChevronDown size={12} />
            </button>
          </DialogTrigger>
          {filters.regions.length === 0 && (
            <span className="prices-all-regions">전국</span>
          )}
          {conditions.map((condition) => (
            <button
              key={condition.key}
              className="prices-condition-chip"
              onClick={condition.clear}
              aria-label={`${condition.label} 조건 해제`}
            >
              <span>{condition.label}</span>
              <X size={12} />
            </button>
          ))}
          {conditions.length > 0 && (
            <button className="prices-clear-chips" onClick={resetFilters}>
              전체 해제
            </button>
          )}
        </div>
      </section>
      <DialogContent className="prices-filter-dialog">
        <DialogHeader>
          <DialogTitle>가격표 필터</DialogTitle>
          <DialogDescription>
            조건을 바꾸면 결과에 바로 반영됩니다. 현재 {summary.count}곳
          </DialogDescription>
        </DialogHeader>
        <div className="prices-filter-controls">
          <fieldset className="prices-region-picker">
            <legend>지역 · 여러 곳 선택</legend>
            <div className="prices-region-actions">
              <button
                type="button"
                onClick={() => updateFilters({ regions: [] })}
              >
                전국으로 변경
              </button>
              <button
                type="button"
                onClick={() =>
                  updateFilters({
                    regions: [
                      ...new Set([
                        ...filters.regions,
                        ...regions.filter((region) =>
                          region.startsWith("서울"),
                        ),
                      ]),
                    ],
                  })
                }
              >
                서울 전체 선택
              </button>
            </div>
            <div className="prices-region-options">
              {regions.map((region) => (
                <label key={region}>
                  <input
                    type="checkbox"
                    checked={filters.regions.includes(region)}
                    onChange={() => toggleRegion(region)}
                    aria-label={`${region} 지역 선택`}
                  />
                  <span>{region}</span>
                </label>
              ))}
            </div>
            <p>
              선택한 지역 중 하나에 해당하는 업체를 보여줍니다. 선택이 없으면
              전국입니다.
            </p>
          </fieldset>
          {filters.kind === "venue" ? (
            <label className="prices-select prices-guests">
              <Users size={14} />
              <GuestCount
                key={filters.guests}
                value={filters.guests}
                onCommit={(guests) => updateFilters({ guests })}
              />
            </label>
          ) : (
            <label className="prices-select prices-planning-metric">
              <Flower2 size={15} />
              <select
                aria-label="가격표 상품과 단위"
                value={filters.planningMetric}
                onChange={(event) =>
                  updateFilters({ planningMetric: event.target.value })
                }
              >
                {planningOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.count}곳
                  </option>
                ))}
              </select>
              <ChevronDown size={12} />
            </label>
          )}
          <label className="prices-select">
            <select
              aria-label="가격표 예산 상한"
              value={filters.budget}
              onChange={(event) =>
                updateFilters({ budget: Number(event.target.value) })
              }
            >
              <option value={0}>
                {filters.kind === "venue"
                  ? "참고비용 제한 없음"
                  : "상품가격 제한 없음"}
              </option>
              {(filters.kind === "venue"
                ? [10000000, 15000000, 20000000, 30000000, 50000000]
                : [100000, 300000, 500000, 1000000, 2000000, 3000000, 5000000]
              ).map((n) => (
                <option value={n} key={n}>
                  {money(n)} 이하
                </option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="prices-select prices-year">
            <select
              aria-label="가격표 적용연도"
              value={filters.year}
              onChange={(event) => updateFilters({ year: event.target.value })}
            >
              <option value="all">모든 적용연도</option>
              {years.map((year) => (
                <option value={String(year)} key={year}>
                  {year}년 적용
                </option>
              ))}
              <option value="unknown">연도 미기재</option>
            </select>
            <ChevronDown size={12} />
          </label>
        </div>
        <div className="prices-filter-options">
          <label>
            <input
              type="checkbox"
              checked={filters.onlyPriced}
              onChange={(event) =>
                updateFilters({ onlyPriced: event.target.checked })
              }
            />
            <span>가격 있는 업체만</span>
          </label>
          <button
            className={cn("prices-saved-toggle", filters.savedOnly && "active")}
            onClick={() => updateFilters({ savedOnly: !filters.savedOnly })}
            aria-pressed={filters.savedOnly}
          >
            <Heart
              size={13}
              fill={filters.savedOnly ? "currentColor" : "none"}
            />
            저장한 업체만{filters.savedOnly && <Check size={12} />}
          </button>
          <span className="prices-filter-hint">
            가격 미확인은 0원으로 계산하지 않아요.
          </span>
          {activeFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="prices-filter-reset"
            >
              <RotateCcw size={12} />
              조건 초기화
            </Button>
          )}
        </div>
        <DialogClose asChild>
          <Button className="prices-filter-done">
            {summary.count}곳 결과 보기
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function GuestCount({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const amount = Number(draft);
  const valid =
    draft.trim() !== "" &&
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= 2000;
  function commit() {
    if (valid) onCommit(amount);
    else setDraft(String(value));
  }
  return (
    <>
      <span className="prices-guests-label">하객</span>
      <input
        type="number"
        min={1}
        max={2000}
        step={1}
        aria-label="가격표 하객 수"
        aria-invalid={!valid}
        title="1~2,000명 · Enter 또는 다른 항목을 누르면 적용"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="prices-guests-label">명</span>
    </>
  );
}
