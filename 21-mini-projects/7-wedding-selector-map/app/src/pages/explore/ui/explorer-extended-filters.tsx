import { Info, RotateCcw } from "lucide-react";
import { money } from "@/shared/lib/format";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerExtendedFiltersProps = ExplorerSectionProps<
  "filters" | "moreFilters" | "resetFilters"
>;
export function ExplorerExtendedFilters({
  filters,
  moreFilters,
  resetFilters,
}: ExplorerExtendedFiltersProps) {
  return (
    moreFilters && (
      <section className="extended-filters" aria-label="추가 검색 조건">
        {filters.kind === "venue" ? (
          <div className="explore-price-ranges">
            {(
              [
                ["대관료", "minRental", "maxRental"],
                ["1인 식대", "minMeal", "maxMeal"],
                [`${filters.guests}명 참고비용`, "minBudget", "maxBudget"],
              ] as const
            ).map(([label, minKey, maxKey]) => {
              const min = filters.priceRanges[minKey];
              const max = filters.priceRanges[maxKey];
              const invalid = min != null && max != null && min > max;
              return (
                <fieldset key={minKey}>
                  <legend>
                    {label} <span>만원</span>
                  </legend>
                  <div className="explore-range-inputs">
                    {([minKey, maxKey] as const).map((key, index) => (
                      <label key={key}>
                        <span>{index === 0 ? "최소" : "최대"}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          inputMode="decimal"
                          aria-label={`${label} ${index === 0 ? "최소" : "최대"} (만원)`}
                          aria-invalid={invalid}
                          placeholder="제한 없음"
                          value={
                            filters.priceRanges[key] == null
                              ? ""
                              : filters.priceRanges[key]! / 10000
                          }
                          onChange={(event) => {
                            const value = event.target.valueAsNumber;
                            filters.setPriceRanges((previous) => ({
                              ...previous,
                              [key]:
                                Number.isFinite(value) && value >= 0
                                  ? Math.round(value * 10000)
                                  : undefined,
                            }));
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  {invalid && (
                    <small role="alert">
                      최대 금액을 최소 금액 이상으로 입력해주세요.
                    </small>
                  )}
                </fieldset>
              );
            })}
          </div>
        ) : (
          <label>
            공개비용 상한
            <select
              aria-label="공개비용 상한"
              value={filters.budget}
              onChange={(event) =>
                filters.setBudget(Number(event.target.value))
              }
            >
              <option value={0}>제한 없음</option>
              {[1000000, 2000000, 3000000, 5000000, 10000000].map((n) => (
                <option key={n} value={n}>
                  {money(n)} 이하
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filters.onlyPriced}
            onChange={(e) => filters.setOnlyPriced(e.target.checked)}
          />
          가격 확인 가능한 업체만
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filters.favoritesOnly}
            onChange={(e) => filters.setFavoritesOnly(e.target.checked)}
          />
          저장한 업체만
        </label>
        <button className="reset-button" onClick={resetFilters}>
          <RotateCcw size={13} />
          초기화
        </button>
        <p>
          <Info size={12} />
          {filters.kind === "venue"
            ? "대관료·식대는 업체별 최저 공시가, 참고비용은 선택 인원과 보증인원을 반영합니다. 범위는 모두 함께 적용되며 해당 가격 미확인 업체는 제외됩니다."
            : "패키지와 개별상품은 구성에 따라 가격 범위가 다릅니다."}
        </p>
      </section>
    )
  );
}
