import type { CostEstimate, Offer, Vendor, VendorFilters } from "./types";

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "공시가 확인 필요";
  if (amount === 0) return "무료";
  return (
    new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(
      amount / 10000,
    ) + "만"
  );
}
export function formatWon(amount: number | null | undefined): string {
  return amount == null
    ? "미공개"
    : new Intl.NumberFormat("ko-KR").format(amount) + "원";
}
interface VenueCostCandidate {
  offer: Offer;
  estimate: CostEstimate;
}
function selectVenueCost(
  vendor: Vendor,
  guests: number,
): VenueCostCandidate | null {
  if (vendor.kind !== "venue") return null;
  const count = Number.isFinite(guests) ? Math.max(1, Math.round(guests)) : 200;
  const candidates = vendor.offers
    .filter(
      (offer) =>
        !offer.additional &&
        offer.meal != null &&
        (offer.minimumAttendees == null || count >= offer.minimumAttendees) &&
        (offer.maximumAttendees == null || count <= offer.maximumAttendees),
    )
    .map((offer) => {
      const billableGuests = Math.max(count, offer.guests ?? 0);
      return {
        offer,
        estimate: {
          min: offer.meal!.min * billableGuests + (offer.rental?.min ?? 0),
          max: offer.meal!.max * billableGuests + (offer.rental?.max ?? 0),
          billableGuests,
          isPartial: true,
          notes: [
            offer.rental
              ? "식대와 공시 대관료 합산"
              : "대관료 미확인 · 식대만 합산",
            "장식·필수 옵션 등 추가 비용 별도",
            ...(offer.condition ? [offer.condition] : []),
          ],
        },
      };
    });
  return candidates.sort((a, b) => a.estimate.min - b.estimate.min)[0] ?? null;
}
/** Use one disclosed offer at a time, preserving that offer's guarantee and rental. */
export function estimatedVenueCost(
  vendor: Vendor,
  guests = 200,
): CostEstimate | null {
  return selectVenueCost(vendor, guests)?.estimate ?? null;
}
export interface VenueCostBreakdown {
  mealUnit: number;
  mealUnitMax: number;
  guarantee: number | null;
  hall: string;
  totalMax: number;
  rentalMax: number | null;
  meal: number;
  rental: number | null;
  total: number;
  billableGuests: number;
  rentalKind: "rental" | "combined";
  condition: string;
}
/** Chart segments come from the exact same eligible offer as the displayed estimate. */
export function getVenueCostBreakdown(
  vendor: Vendor,
  guests = 200,
): VenueCostBreakdown | null {
  const selected = selectVenueCost(vendor, guests);
  if (!selected) return null;
  const { offer, estimate } = selected;
  return {
    mealUnit: offer.meal!.min,
    mealUnitMax: offer.meal!.max,
    guarantee: offer.guests,
    hall: offer.hall,
    totalMax: estimate.max,
    rentalMax: offer.rental?.max ?? null,
    meal: offer.meal!.min * estimate.billableGuests,
    rental: offer.rental?.min ?? null,
    total: estimate.min,
    billableGuests: estimate.billableGuests,
    rentalKind: offer.rentalKind,
    condition: offer.condition,
  };
}
export const estimateVenueCost = estimatedVenueCost;
/** Planning comparison prioritizes actual package terms, otherwise individual basic service. */
export function getComparablePrice(
  vendor: Vendor,
  guests = 200,
): number | null {
  return vendor.kind === "venue"
    ? (estimatedVenueCost(vendor, guests)?.min ?? null)
    : (vendor.packageMin ?? vendor.serviceMin);
}
export function getPriceLabel(vendor: Vendor): string {
  return vendor.kind === "venue"
    ? "식대 / 1인"
    : vendor.packageMin != null
      ? "공시 패키지"
      : "개별 기본상품부터";
}
export function filterVendors(
  vendors: Vendor[],
  filters: VendorFilters = {},
): Vendor[] {
  const normalizeSearch = (value: string) =>
    value
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[^\p{L}\p{N}]/gu, "");
  const queryTerms = (filters.query ?? "")
    .trim()
    .split(/\s+/)
    .map(normalizeSearch)
    .filter(Boolean);
  const matches = vendors.filter((vendor) => {
    if (filters.kind && filters.kind !== "all" && vendor.kind !== filters.kind)
      return false;
    if (
      filters.region &&
      filters.region !== "전체" &&
      filters.region !== "all" &&
      vendor.region !== filters.region &&
      !(filters.region === "서울" && vendor.region.startsWith("서울"))
    )
      return false;
    const searchable = normalizeSearch(
      [vendor.name, vendor.address, vendor.region, ...vendor.categories].join(
        " ",
      ),
    );
    if (!queryTerms.every((term) => searchable.includes(term))) return false;
    if (filters.ids && !filters.ids.includes(vendor.id)) return false;
    const within = (value: number | null, min?: number, max?: number) =>
      (min == null && max == null) ||
      (value != null &&
        (min == null || value >= min) &&
        (max == null || value <= max));
    if (!within(vendor.mealMin, filters.minMeal, filters.maxMeal)) return false;
    if (!within(vendor.rentalMin, filters.minRental, filters.maxRental))
      return false;
    const comparable = getComparablePrice(vendor, filters.guests);
    if (!within(comparable, filters.minBudget, filters.maxBudget)) return false;
    return !filters.onlyPriced || comparable != null;
  });
  const sort = filters.sort ?? "recommended";
  return [...matches].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "ko");
    const aPrice = getComparablePrice(a, filters.guests);
    const bPrice = getComparablePrice(b, filters.guests);
    if (aPrice == null && bPrice != null) return 1;
    if (aPrice != null && bPrice == null) return -1;
    if (sort === "price-asc") return (aPrice ?? 0) - (bPrice ?? 0);
    if (sort === "price-desc") return (bPrice ?? 0) - (aPrice ?? 0);
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return (
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
      a.name.localeCompare(b.name, "ko")
    );
  });
}
