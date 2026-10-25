import {
  getPlanningPrices,
  getVenueCostBreakdown,
  planningCategoryLabels,
  planningServiceCategories,
  summarizePrices,
  type PlanningPriceSummary,
  type PlanningServiceCategory,
  type PriceTerm,
  type Vendor,
  type VendorKind,
} from "@/entities/vendor";

export type PriceTableSortKey =
  | "name"
  | "price"
  | "meal"
  | "rental"
  | "guests"
  | "guarantee"
  | "year"
  | "region";
export interface PriceTableSort {
  key: PriceTableSortKey;
  direction: "asc" | "desc";
}
export interface PriceTableRow {
  id: string;
  vendor: Vendor;
  price: number | null;
  priceMax: number | null;
  meal: number | null;
  mealMax: number | null;
  rental: number | null;
  rentalMax: number | null;
  mealTotal: number | null;
  billableGuests: number | null;
  guarantee: number | null;
  basisLabel: string;
  condition: string;
  offerLabel: string;
  canEstimate: boolean;
  rentalKind: "rental" | "combined";
  partial: boolean;
  planningMetric: string | null;
  freeAvailable: boolean;
  includedAvailable: boolean;
}
export interface PriceRowsOptions {
  kind: VendorKind;
  guests?: number;
  planningMetric?: string;
}
export interface PriceRowsFilters {
  query?: string;
  region?: string;
  regions?: readonly string[];
  maxBudget?: number;
  onlyPriced?: boolean;
  savedOnly?: boolean;
  savedIds?: readonly string[];
  ids?: readonly string[];
}
export interface PlanningMetricOption {
  value: string;
  label: string;
  count: number;
}
export type PriceTablePageSize = 20 | 50 | 100;
export interface PriceTablePagination {
  rows: PriceTableRow[];
  page: number;
  pageSize: PriceTablePageSize;
  pageCount: number;
  total: number;
  /** One-based displayed range; both are zero for an empty result. */
  start: number;
  end: number;
}
export interface PriceTableSummary {
  count: number;
  total: number;
  pricedCount: number;
  unknownCount: number;
  comparable: boolean;
  min: number | null;
  max: number | null;
  median: number | null;
  average: number | null;
}

const defaultPlanningMetric = "package:package";
const unitLabels: Record<PriceTerm["basis"], string> = {
  person: "1인",
  item: "상품 기준",
  package: "패키지 기준",
};
const commonPlanningMetrics = [
  "package:package",
  "studio:item",
  "dress:item",
  "makeup:person",
  "makeup:item",
];

function normalizeGuests(guests = 200) {
  return Number.isFinite(guests) ? Math.max(1, Math.round(guests)) : 200;
}
function parsePlanningMetric(metric = defaultPlanningMetric) {
  const [rawCategory, rawBasis, extra] = metric.split(":");
  const valid =
    extra == null &&
    planningServiceCategories.includes(
      rawCategory as PlanningServiceCategory,
    ) &&
    Object.hasOwn(unitLabels, rawBasis);
  const [category, basis] = (valid ? metric : defaultPlanningMetric).split(
    ":",
  ) as [PlanningServiceCategory, PriceTerm["basis"]];
  return { category, basis, key: `${category}:${basis}` };
}
function metricLabel(
  category: PlanningServiceCategory,
  basis: PriceTerm["basis"],
) {
  return `${planningCategoryLabels[category]} · ${unitLabels[basis]}`;
}

/** Options describe exactly one service and one calculation unit. */
export function getPlanningMetricOptions(
  vendors: readonly Vendor[],
): PlanningMetricOption[] {
  const options = new Map<string, PlanningMetricOption>();
  for (const metric of commonPlanningMetrics) {
    const { category, basis, key } = parsePlanningMetric(metric);
    options.set(key, {
      value: key,
      label: metricLabel(category, basis),
      count: 0,
    });
  }
  for (const vendor of vendors) {
    const counted = new Set<string>();
    for (const group of getPlanningPrices(vendor)) {
      const key = `${group.category}:${group.basis}`;
      const option = options.get(key) ?? {
        value: key,
        label: metricLabel(group.category, group.basis),
        count: 0,
      };
      if (
        group.min != null &&
        Number.isFinite(group.min) &&
        !counted.has(key)
      ) {
        option.count++;
        counted.add(key);
      }
      options.set(key, option);
    }
  }
  return [...options.values()];
}

function emptyRow(vendor: Vendor): PriceTableRow {
  return {
    id: vendor.id,
    vendor,
    price: null,
    priceMax: null,
    meal: null,
    mealMax: null,
    rental: null,
    rentalMax: null,
    mealTotal: null,
    billableGuests: null,
    guarantee: null,
    basisLabel: "",
    condition: "",
    offerLabel: "",
    canEstimate: false,
    rentalKind: "rental",
    partial: true,
    planningMetric: null,
    freeAvailable: false,
    includedAvailable: false,
  };
}
function venueRow(vendor: Vendor, guests: number): PriceTableRow {
  const base = emptyRow(vendor);
  const cost = getVenueCostBreakdown(vendor, guests);
  if (!cost) {
    return {
      ...base,
      basisLabel: `${guests}명 기준`,
      condition: "이 하객 수에 적용할 가격 정보가 없어 상담이 필요해요.",
    };
  }
  const notes = [
    cost.condition,
    cost.billableGuests > guests
      ? `보증인원 ${cost.billableGuests}명 적용`
      : "",
    cost.rental == null ? "대관료 미확인 · 식대만 계산" : "",
    "장식·필수 옵션 등 추가 비용 별도",
  ].filter(Boolean);
  return {
    ...base,
    price: cost.total,
    priceMax: cost.totalMax,
    meal: cost.mealUnit,
    mealMax: cost.mealUnitMax,
    rental: cost.rental,
    rentalMax: cost.rentalMax,
    mealTotal: cost.meal,
    billableGuests: cost.billableGuests,
    guarantee: cost.guarantee,
    basisLabel: `${guests}명 기준`,
    condition: notes.join(" · "),
    offerLabel: cost.hall,
    canEstimate: true,
    rentalKind: cost.rentalKind,
  };
}
function planningConditions(group: PlanningPriceSummary | undefined) {
  return [
    group?.freeAvailable ? "조건별 무료 항목 있음" : "",
    group?.includedAvailable ? "다른 상품에 포함된 항목 있음" : "",
    "상품 구성·성별·적용 기간과 추가 옵션에 따라 달라질 수 있어요.",
  ]
    .filter(Boolean)
    .join(" · ");
}
function planningRow(vendor: Vendor, metric: string): PriceTableRow {
  const { category, basis, key } = parsePlanningMetric(metric);
  const group = getPlanningPrices(vendor).find(
    (price) => price.category === category && price.basis === basis,
  );
  const price = group?.min ?? null;
  return {
    ...emptyRow(vendor),
    price,
    priceMax: price == null ? null : (group?.max ?? price),
    basisLabel: metricLabel(category, basis),
    condition: planningConditions(group),
    canEstimate: price != null,
    planningMetric: key,
    freeAvailable: group?.freeAvailable ?? false,
    includedAvailable: group?.includedAvailable ?? false,
  };
}

/** One row per vendor, retaining unknowns; never fall back to another planning product. */
export function normalizePriceRows(
  vendors: readonly Vendor[],
  options: PriceRowsOptions,
): PriceTableRow[] {
  const guests = normalizeGuests(options.guests);
  return vendors
    .filter((vendor) => vendor.kind === options.kind)
    .map((vendor) =>
      options.kind === "venue"
        ? venueRow(vendor, guests)
        : planningRow(vendor, options.planningMetric ?? defaultPlanningMetric),
    );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function matchesRegion(vendor: Vendor, region?: string) {
  return (
    !region ||
    region === "전체" ||
    region === "all" ||
    vendor.region === region ||
    (region === "서울" && vendor.region.startsWith("서울"))
  );
}
export function filterPriceRows(
  rows: readonly PriceTableRow[],
  filters: PriceRowsFilters = {},
): PriceTableRow[] {
  const terms = (filters.query ?? "")
    .trim()
    .split(/\s+/)
    .map(normalizeSearch)
    .filter(Boolean);
  const savedIds = new Set(filters.savedIds ?? []);
  const ids = filters.ids ? new Set(filters.ids) : null;
  const hasBudget =
    filters.maxBudget != null &&
    Number.isFinite(filters.maxBudget) &&
    filters.maxBudget >= 0;
  return rows.filter((row) => {
    const selectedRegions =
      filters.regions ?? (filters.region ? [filters.region] : []);
    if (
      selectedRegions.length > 0 &&
      !selectedRegions.some((region) => matchesRegion(row.vendor, region))
    )
      return false;
    const search = normalizeSearch(
      [row.vendor.name, row.vendor.address, row.vendor.region].join(" "),
    );
    if (!terms.every((term) => search.includes(term))) return false;
    if (ids && !ids.has(row.id)) return false;
    if (filters.savedOnly && !savedIds.has(row.id)) return false;
    if (filters.onlyPriced && row.price == null) return false;
    return !hasBudget || (row.price != null && row.price <= filters.maxBudget!);
  });
}

function sortValue(row: PriceTableRow, key: PriceTableSortKey) {
  switch (key) {
    case "name":
      return row.vendor.name;
    case "region":
      return row.vendor.region;
    case "year":
      return row.vendor.priceYear;
    case "guests":
    case "guarantee":
      return row.guarantee;
    default:
      return row[key];
  }
}
export function sortPriceRows(
  rows: readonly PriceTableRow[],
  sort: PriceTableSort = { key: "price", direction: "asc" },
): PriceTableRow[] {
  return [...rows].sort((a, b) => {
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    if (left == null && right != null) return 1;
    if (left != null && right == null) return -1;
    const order =
      left == null || right == null
        ? 0
        : typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right, "ko")
          : Number(left) - Number(right);
    return (
      (sort.direction === "desc" ? -order : order) ||
      a.vendor.name.localeCompare(b.vendor.name, "ko") ||
      a.id.localeCompare(b.id)
    );
  });
}

export function paginatePriceRows(
  rows: readonly PriceTableRow[],
  page = 1,
  pageSize: number = 20,
): PriceTablePagination {
  const size: PriceTablePageSize =
    pageSize === 50 || pageSize === 100 ? pageSize : 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Number.isFinite(page)
    ? Math.min(pageCount, Math.max(1, Math.floor(page)))
    : 1;
  const offset = (current - 1) * size;
  return {
    rows: rows.slice(offset, offset + size),
    page: current,
    pageSize: size,
    pageCount,
    total: rows.length,
    start: rows.length ? offset + 1 : 0,
    end: Math.min(offset + size, rows.length),
  };
}

/** Refuse numeric summaries across mixed product units or different guest bases. */
export function getPriceTableSummary(
  rows: readonly PriceTableRow[],
): PriceTableSummary {
  const values = rows.flatMap((row) =>
    row.price == null || !Number.isFinite(row.price) || row.price < 0
      ? []
      : [row.price],
  );
  const cohorts = new Set(
    rows.map((row) =>
      row.vendor.kind === "venue"
        ? `venue:${row.basisLabel}`
        : `planning:${row.planningMetric}`,
    ),
  );
  const comparable = cohorts.size <= 1;
  const statistics = comparable ? summarizePrices(values) : null;
  return {
    count: rows.length,
    total: rows.length,
    pricedCount: values.length,
    unknownCount: rows.length - values.length,
    comparable,
    min: statistics?.min ?? null,
    max: statistics?.max ?? null,
    median: statistics?.median ?? null,
    average: statistics?.mean ?? null,
  };
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  // Ignore leading whitespace when guarding spreadsheet formula interpreters.
  const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
/** Caller supplies the complete filtered/sorted cohort, rather than only one page. */
export function priceRowsToCsv(rows: readonly PriceTableRow[], guests = 200) {
  const header = [
    "업체명",
    "분류",
    "지역",
    "가격기준",
    "선택하객수",
    "계산적용인원",
    "보증인원",
    "선택조건식대최저(원)",
    "선택조건식대최고(원)",
    "선택조건식대합계최저(원)",
    "선택조건대관료최저(원)",
    "선택조건대관료최고(원)",
    "대관항목",
    "참고금액최저(원)",
    "참고금액최고(원)",
    "적용연도",
    "선택홀",
    "조건및포함범위",
  ];
  const records = rows.map((row) => [
    row.vendor.name,
    row.vendor.kind === "venue" ? "웨딩홀" : "결혼준비대행",
    row.vendor.region,
    row.basisLabel,
    row.vendor.kind === "venue" ? normalizeGuests(guests) : "",
    row.billableGuests,
    row.guarantee,
    row.meal,
    row.mealMax,
    row.mealTotal,
    row.rental,
    row.rentalMax,
    row.vendor.kind === "venue"
      ? row.rentalKind === "combined"
        ? "대관·장식 합계"
        : "대관료"
      : "",
    row.price,
    row.priceMax,
    row.vendor.priceYear,
    row.offerLabel,
    row.condition,
  ]);
  return (
    "\uFEFF" +
    [header, ...records]
      .map((record) => record.map(csvCell).join(","))
      .join("\r\n")
  );
}
