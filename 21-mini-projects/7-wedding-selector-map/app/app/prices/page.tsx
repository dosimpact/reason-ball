import type { Metadata } from "next";
import { getVendorSummaries } from "@/entities/vendor/server";
import { PricesPage, readPriceFilters, type PriceQuery } from "@/pages/prices";
import { getPlanningMetricOptions } from "@/features/price-table";
export const metadata: Metadata = {
  title: "가격표 — 오롯 Wedding Atlas",
  description:
    "지도 없이 한눈에 살펴보는 웨딩홀과 스드메 가격. 같은 하객 수와 상품 단위로 후보를 좁혀보세요.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PriceQuery>;
}) {
  const params = await searchParams;
  const vendors = getVendorSummaries();
  const initialFilters = readPriceFilters(params);
  if (initialFilters.kind === "planning" && typeof params.metric !== "string")
    initialFilters.planningMetric =
      getPlanningMetricOptions(vendors).sort((a, b) => b.count - a.count)[0]
        ?.value ?? initialFilters.planningMetric;
  return <PricesPage vendors={vendors} initialFilters={initialFilters} />;
}
