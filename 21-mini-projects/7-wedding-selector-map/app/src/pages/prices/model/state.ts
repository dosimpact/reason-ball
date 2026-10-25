import type { VendorKind } from "@/entities/vendor";
import type { PriceTableSort } from "@/features/price-table";
export interface PriceFilters {
  kind: VendorKind;
  query: string;
  regions: string[];
  guests: number;
  planningMetric: string;
  budget: number;
  onlyPriced: boolean;
  savedOnly: boolean;
  year: string;
  page: number;
  pageSize: number;
  sort: PriceTableSort;
}
export type PriceQuery = Record<string, string | string[] | undefined>;
const sortKeys = [
  "price",
  "meal",
  "rental",
  "guarantee",
  "name",
  "region",
  "year",
];
function numberInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed =
    typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? Math.round(parsed)
    : fallback;
}
export function readPriceFilters(params: PriceQuery): PriceFilters {
  return {
    kind: params.kind === "planning" ? "planning" : "venue",
    query: typeof params.q === "string" ? params.q : "",
    regions: [
      ...new Set(
        (Array.isArray(params.region)
          ? params.region
          : typeof params.region === "string"
            ? [params.region]
            : []
        )
          .flatMap((region) =>
            region === "서울" ? ["서울(강남)", "서울(강남외)"] : [region],
          )
          .filter((region) => region && region !== "전체" && region !== "all"),
      ),
    ],
    guests: numberInRange(params.guests, 200, 1, 2000),
    planningMetric:
      typeof params.metric === "string" &&
      /^(studio|dress|makeup|package|other):(person|item|package)$/.test(
        params.metric,
      )
        ? params.metric
        : "package:package",
    budget: numberInRange(params.budget, 0, 0, 1000000000),
    onlyPriced: params.priced === "1",
    savedOnly: params.saved === "1",
    year:
      typeof params.year === "string" &&
      /^(all|unknown|20\d{2})$/.test(params.year)
        ? params.year
        : "all",
    page: numberInRange(params.page, 1, 1, 10000),
    pageSize: [20, 50, 100].includes(Number(params.size))
      ? Number(params.size)
      : 20,
    sort: {
      key:
        typeof params.sort === "string" && sortKeys.includes(params.sort)
          ? (params.sort as PriceTableSort["key"])
          : "price",
      direction: params.dir === "desc" ? "desc" : "asc",
    },
  };
}
export function priceFiltersQuery(filters: PriceFilters, page = filters.page) {
  const params = new URLSearchParams({
    kind: filters.kind,
    guests: String(filters.guests),
    sort: filters.sort.key,
    dir: filters.sort.direction,
    size: String(filters.pageSize),
    page: String(page),
  });
  if (filters.query) params.set("q", filters.query);
  for (const region of filters.regions) params.append("region", region);
  if (filters.kind === "planning") params.set("metric", filters.planningMetric);
  if (filters.budget) params.set("budget", String(filters.budget));
  if (filters.onlyPriced) params.set("priced", "1");
  if (filters.savedOnly) params.set("saved", "1");
  if (filters.year !== "all") params.set("year", filters.year);
  return params.toString();
}
