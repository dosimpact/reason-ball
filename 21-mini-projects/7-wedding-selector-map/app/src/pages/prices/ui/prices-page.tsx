"use client";
import { Check, ChevronDown, TableProperties } from "lucide-react";
import { PriceTable } from "@/widgets/price-table";
import {
  usePriceBrowser,
  type PricesPageProps,
} from "../model/use-price-browser";
import { PricesHeader, PricesRail } from "./prices-navigation";
import { PricesSummaryDialog } from "./prices-summary";
import { PricesToolbar } from "./prices-toolbar";
import { PricesPagination, PricesSelection } from "./prices-footer";
import { PricesCompare, PricesDetail, PricesGuide } from "./prices-dialogs";
import "./prices.css";
export function PricesPage(props: PricesPageProps) {
  const browser = usePriceBrowser(props);
  return (
    <div className="prices-page">
      <a href="#prices-table" className="prices-skip">
        가격표로 건너뛰기
      </a>
      <PricesRail {...browser} />
      <div className="prices-body">
        <PricesHeader {...browser} />
        <main className="prices-main">
          <PricesToolbar {...browser} />
          <section
            className="prices-table-area"
            id="prices-table"
            aria-label="전체 가격표"
            aria-busy={browser.isPending}
          >
            <div className="prices-table-heading">
              <div>
                <TableProperties size={16} />
                <h2>
                  {browser.filters.kind === "venue" ? "웨딩홀" : "준비대행"}{" "}
                  가격표
                </h2>
                <span>{browser.metricLabel}</span>
              </div>
              <PricesSummaryDialog {...browser} />
            </div>
            <PriceTable
              key={`${browser.filters.kind}:${browser.filters.planningMetric}`}
              rows={browser.pagination.rows}
              kind={browser.filters.kind}
              sort={browser.filters.sort}
              onSort={browser.sortBy}
              favoriteIds={browser.favorites.ids}
              comparisonIds={browser.comparison.ids}
              onFavorite={browser.favorites.toggle}
              onCompare={browser.toggleCompare}
              onSelect={browser.selectVendor}
              startIndex={Math.max(0, browser.pagination.start - 1)}
              priceScaleMax={browser.priceScaleMax}
              selectedId={browser.selectedId}
              guests={browser.filters.guests}
            />
            {!browser.summary.count && browser.activeFilters && (
              <button
                className="prices-empty-reset"
                onClick={browser.resetFilters}
              >
                조건 초기화하고 전체 보기
              </button>
            )}
            <PricesPagination {...browser} />
          </section>
        </main>
        <PricesSelection {...browser} />
        <footer className="prices-site-footer">
          <span>오롯, 둘만의 기준을 찾아가는 여정.</span>
          <button onClick={() => browser.setGuideOpen(true)}>
            가격 비교 기준 <ChevronDown size={10} />
          </button>
          <span>© OROT WEDDING ATLAS</span>
        </footer>
      </div>
      <PricesDetail {...browser} />
      <PricesCompare {...browser} />
      <PricesGuide {...browser} />
      {browser.toast && (
        <div className="prices-toast" role="status">
          <Check size={15} />
          {browser.toast}
        </div>
      )}
    </div>
  );
}
