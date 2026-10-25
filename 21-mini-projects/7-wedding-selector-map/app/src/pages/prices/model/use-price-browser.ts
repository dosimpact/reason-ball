"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Vendor, VendorKind } from "@/entities/vendor";
import {
  filterPriceRows,
  getPlanningMetricOptions,
  getPriceTableSummary,
  normalizePriceRows,
  paginatePriceRows,
  priceRowsToCsv,
  sortPriceRows,
  type PriceTableSortKey,
} from "@/features/price-table";
import { useShortlist } from "@/features/shortlist";
import { useVendorDetail } from "@/features/vendor-details";
import { priceFiltersQuery, type PriceFilters } from "./state";
export interface PricesPageProps {
  vendors: Vendor[];
  initialFilters: PriceFilters;
}
export function usePriceBrowser({ vendors, initialFilters }: PricesPageProps) {
  const [filters, setFilters] = useState(initialFilters);
  const planningVisited = useRef(initialFilters.kind === "planning");
  const query = useDeferredValue(filters.query);
  const favorites = useShortlist("orot:favorites");
  const comparison = useShortlist("orot:comparison", 3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const { loadedVendor, detailError } = useVendorDetail(selectedId);
  const regions = useMemo(
    () =>
      [...new Set(vendors.map((v) => v.region))].sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [vendors],
  );
  const years = useMemo(
    () =>
      [
        ...new Set(
          vendors
            .filter((v) => v.kind === filters.kind)
            .flatMap((v) => (v.priceYear ? [v.priceYear] : [])),
        ),
      ].sort((a, b) => a - b),
    [vendors, filters.kind],
  );
  const planningOptions = useMemo(
    () => getPlanningMetricOptions(vendors),
    [vendors],
  );
  const allRows = useMemo(
    () =>
      normalizePriceRows(vendors, {
        kind: filters.kind,
        guests: filters.guests,
        planningMetric: filters.planningMetric,
      }),
    [vendors, filters.kind, filters.guests, filters.planningMetric],
  );
  const filteredRows = useMemo(
    () =>
      filterPriceRows(allRows, {
        query,
        regions: filters.regions,
        maxBudget: filters.budget || undefined,
        onlyPriced: filters.onlyPriced,
        savedOnly: filters.savedOnly,
        savedIds: favorites.ids,
      }).filter(
        (row) =>
          filters.year === "all" ||
          (filters.year === "unknown"
            ? row.vendor.priceYear == null
            : String(row.vendor.priceYear) === filters.year),
      ),
    [
      allRows,
      query,
      filters.regions,
      filters.budget,
      filters.onlyPriced,
      filters.savedOnly,
      filters.year,
      favorites.ids,
    ],
  );
  const sortedRows = useMemo(
    () => sortPriceRows(filteredRows, filters.sort),
    [filteredRows, filters.sort],
  );
  const pagination = useMemo(
    () => paginatePriceRows(sortedRows, filters.page, filters.pageSize),
    [sortedRows, filters.page, filters.pageSize],
  );
  const summary = useMemo(() => getPriceTableSummary(sortedRows), [sortedRows]);
  const priceScaleMax = Math.max(
    1,
    ...sortedRows.map((row) => row.priceMax ?? row.price ?? 0),
  );
  const comparisonVendors = comparison.ids
    .map((id) => vendors.find((v) => v.id === id))
    .filter((v): v is Vendor => !!v);
  const selectedSummary = vendors.find((v) => v.id === selectedId);
  const selectedVendor =
    loadedVendor?.id === selectedId ? loadedVendor : selectedSummary;
  const metricLabel =
    filters.kind === "venue"
      ? `하객 ${filters.guests}명 기준`
      : (planningOptions.find(
          (option) => option.value === filters.planningMetric,
        )?.label ?? "공시 패키지");
  const activeFilters = Boolean(
    filters.query ||
    filters.regions.length > 0 ||
    filters.budget ||
    filters.onlyPriced ||
    filters.savedOnly ||
    filters.year !== "all" ||
    (filters.kind === "venue" && filters.guests !== 200),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = priceFiltersQuery(filters, pagination.page);
    window.history.replaceState(null, "", url);
  }, [filters, pagination.page]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  function updateFilters(patch: Partial<PriceFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }
  function changeKind(kind: VendorKind) {
    const planningMetric =
      kind === "planning" && !planningVisited.current
        ? ([...planningOptions].sort((a, b) => b.count - a.count)[0]?.value ??
          filters.planningMetric)
        : filters.planningMetric;
    if (kind === "planning") planningVisited.current = true;
    updateFilters({
      kind,
      planningMetric,
      budget: 0,
      year: "all",
      sort: { key: "price", direction: "asc" },
    });
  }
  function sortBy(key: PriceTableSortKey) {
    updateFilters({
      sort: {
        key,
        direction:
          filters.sort.key === key && filters.sort.direction === "asc"
            ? "desc"
            : "asc",
      },
    });
  }
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }
  function toggleCompare(id: string) {
    if (!comparison.toggle(id))
      notify("최대 3곳까지 비교할 수 있어요. 담아둔 업체를 먼저 빼주세요.");
  }
  function selectVendor(id: string) {
    detailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelectedId(id);
  }
  function closeDetail() {
    setSelectedId(null);
    requestAnimationFrame(() => {
      if (detailTrigger.current?.isConnected)
        detailTrigger.current.focus({ preventScroll: true });
    });
  }
  function resetFilters() {
    updateFilters({
      query: "",
      regions: [],
      guests: 200,
      budget: 0,
      onlyPriced: false,
      savedOnly: false,
      year: "all",
      sort: { key: "price", direction: "asc" },
    });
  }
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([priceRowsToCsv(sortedRows, filters.guests)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      filters.kind === "venue"
        ? `오롯_웨딩홀_가격표_${filters.guests}명.csv`
        : "오롯_준비대행_가격표.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`현재 조건의 ${sortedRows.length}곳을 가격표로 저장했어요.`);
  }
  return {
    vendors,
    filters,
    updateFilters,
    changeKind,
    sortBy,
    regions,
    years,
    planningOptions,
    pagination,
    summary,
    priceScaleMax,
    comparisonVendors,
    selectedVendor,
    selectedId,
    loadedVendor,
    detailError,
    metricLabel,
    activeFilters,
    favorites,
    comparison,
    toggleCompare,
    selectVendor,
    closeDetail,
    compareOpen,
    setCompareOpen,
    guideOpen,
    setGuideOpen,
    toast,
    exportCsv,
    resetFilters,
    isPending: query !== filters.query,
  };
}
export type PriceBrowser = ReturnType<typeof usePriceBrowser>;
export type PriceBrowserProps<Key extends keyof PriceBrowser> = Pick<
  PriceBrowser,
  Key
>;
