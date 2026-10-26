import type {
  PlanningPriceSummary,
  PlanningServiceCategory,
  PriceTerm,
  Vendor,
} from "./types";

export const planningServiceCategories: PlanningServiceCategory[] = [
  "studio",
  "dress",
  "makeup",
  "package",
  "other",
];
export const planningCategoryLabels: Record<PlanningServiceCategory, string> = {
  studio: "스튜디오",
  dress: "드레스",
  makeup: "메이크업",
  package: "패키지",
  other: "기타 기본상품",
};
const unitLabels: Record<PriceTerm["basis"], string> = {
  person: "1인",
  item: "상품 기준",
  package: "패키지 기준",
};

function isPlanningCategory(
  category: PriceTerm["category"],
): category is PlanningServiceCategory {
  return planningServiceCategories.includes(
    category as PlanningServiceCategory,
  );
}

/** Keep categories and per-person/item/package units apart; never sum them. */
export function buildPlanningPrices(
  terms: PriceTerm[],
): PlanningPriceSummary[] {
  const groups = new Map<string, PlanningPriceSummary>();
  for (const term of terms) {
    if (
      !isPlanningCategory(term.category) ||
      term.role === "discount" ||
      term.role === "surcharge"
    )
      continue;
    if (!["known", "free", "included"].includes(term.state)) continue;
    const hasAmount =
      term.state === "known" &&
      term.min != null &&
      Number.isFinite(term.min) &&
      term.min >= 0 &&
      (term.max == null || (Number.isFinite(term.max) && term.max >= term.min));
    if (term.state === "known" && !hasAmount) continue;
    const key = `${term.category}:${term.basis}`;
    const group = groups.get(key) ?? {
      category: term.category,
      basis: term.basis,
      unitLabel: unitLabels[term.basis],
      min: null,
      max: null,
      freeAvailable: false,
      includedAvailable: false,
    };
    if (hasAmount) {
      group.min = Math.min(group.min ?? Infinity, term.min!);
      group.max = Math.max(group.max ?? -Infinity, term.max ?? term.min!);
    }
    if (term.state === "free") group.freeAvailable = true;
    if (term.state === "included") group.includedAvailable = true;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      planningServiceCategories.indexOf(a.category) -
        planningServiceCategories.indexOf(b.category) ||
      a.basis.localeCompare(b.basis),
  );
}

/** Summaries retain this compact profile even when raw priceTerms are lazy-loaded. */
export function getPlanningPrices(
  vendor: Pick<Vendor, "kind" | "priceTerms" | "planningPrices">,
): PlanningPriceSummary[] {
  if (vendor.kind !== "planning") return [];
  return vendor.planningPrices ?? buildPlanningPrices(vendor.priceTerms);
}

/** Explain the category/unit behind the representative minimum already on the card. */
export function getPlanningPriceCaption(vendor: Vendor): string {
  if (vendor.packageMin != null) return "공시 패키지";
  const groups = getPlanningPrices(vendor).filter(
    (group) => group.category !== "package" && group.min != null,
  );
  const representative =
    groups.find((group) => group.min === vendor.serviceMin) ??
    groups.sort((a, b) => a.min! - b.min!)[0];
  if (!representative) return "개별 기본상품";
  const category = planningCategoryLabels[representative.category];
  return representative.basis === "person"
    ? `${category} · 1인`
    : `${category} · 기본상품`;
}
