import type { Vendor } from "./types";

/** Keep source data intact; omit zero-start rental conditions from consumer prices. */
export function applyComparisonPolicy(vendor: Vendor): Vendor {
  if (vendor.kind !== "venue") return vendor;
  const offers = vendor.offers.filter((offer) => offer.rental?.min !== 0);
  if (offers.length === vendor.offers.length) return vendor;
  const base = offers.filter((offer) => !offer.additional);
  const meals = base.flatMap((offer) => (offer.meal ? [offer.meal] : []));
  const rentals = base.flatMap((offer) => (offer.rental ? [offer.rental] : []));
  const guarantees = base.flatMap((offer) =>
    offer.guests != null ? [offer.guests] : [],
  );
  return {
    ...vendor,
    offers,
    mealMin: meals.length ? Math.min(...meals.map((price) => price.min)) : null,
    mealMax: meals.length ? Math.max(...meals.map((price) => price.max)) : null,
    rentalMin: rentals.length
      ? Math.min(...rentals.map((price) => price.min))
      : null,
    guestsMin: guarantees.length ? Math.min(...guarantees) : null,
    warnings: [
      ...vendor.warnings,
      "대관료 최저값이 0원인 조건은 가격 비교에서 제외했습니다.",
    ],
  };
}
