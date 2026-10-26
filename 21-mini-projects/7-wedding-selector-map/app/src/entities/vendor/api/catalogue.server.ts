import { applyComparisonPolicy } from "../model/comparison-policy";
import data from "../data/vendors.json";
import type { Vendor } from "../model/types";
import { buildPlanningPrices } from "../model/planning-prices";
const vendors: Vendor[] = (data as unknown as Vendor[]).map((vendor) =>
  vendor.kind === "planning"
    ? { ...vendor, planningPrices: buildPlanningPrices(vendor.priceTerms) }
    : applyComparisonPolicy(vendor),
);
/** Consumer responses carry price/condition data, without document-viewing metadata. */
function consumerVendor(vendor: Vendor): Vendor {
  return {
    ...vendor,
    documents: [],
    sources: [],
    evidence: [],
    sourceUrl: "",
    offers: vendor.offers.map((offer) => ({ ...offer, evidence: undefined })),
    model: { ...vendor.model, previousDisclosures: undefined },
  };
}
export function getVendor(id: string) {
  const vendor = vendors.find((vendor) => vendor.id === id);
  return vendor ? consumerVendor(vendor) : undefined;
}
/** Lists carry only fields needed for searching, cards, map and comparison. */
export function getVendorSummaries(): Vendor[] {
  return vendors.map((vendor) => ({
    ...consumerVendor(vendor),
    priceTerms: [],
  }));
}
