import {
  estimatedVenueCost,
  getPlanningPrices,
  planningCategoryLabels,
  type Vendor,
  type PlanningServiceCategory,
  type PriceTerm,
} from "@/entities/vendor";
export interface MetricOption {
  key: string;
  label: string;
  count: number;
}
export interface OverviewPoint {
  id: string;
  value: number;
}
export function planningMetricOptions(vendors: Vendor[]): MetricOption[] {
  const options = new Map<string, MetricOption>();
  for (const vendor of vendors)
    for (const price of getPlanningPrices(vendor)) {
      if (price.min == null) continue;
      const key = `${price.category}:${price.basis}`;
      const current = options.get(key) ?? {
        key,
        label: `${planningCategoryLabels[price.category]} · ${price.unitLabel}`,
        count: 0,
      };
      current.count++;
      options.set(key, current);
    }
  return [...options.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"),
  );
}
export function overviewPoints(
  vendors: Vendor[],
  metric: string,
  guests: number,
): OverviewPoint[] {
  return vendors.flatMap((vendor) => {
    let value: number | null = null;
    if (vendor.kind === "venue")
      value =
        metric === "meal"
          ? vendor.mealMin
          : (estimatedVenueCost(vendor, guests)?.min ?? null);
    else {
      const [category, basis] = metric.split(":") as [
        PlanningServiceCategory,
        PriceTerm["basis"],
      ];
      value =
        getPlanningPrices(vendor).find(
          (price) => price.category === category && price.basis === basis,
        )?.min ?? null;
    }
    return value != null && Number.isFinite(value) && value >= 0
      ? [{ id: vendor.id, value }]
      : [];
  });
}
