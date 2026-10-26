/** Read projection of the disclosure superset. Amounts are KRW; null never means free. */
export type VendorKind = "venue" | "planning";
export type ServiceCategory =
  | "meal"
  | "rental"
  | "decoration"
  | "studio"
  | "dress"
  | "makeup"
  | "package"
  | "other";
export type PriceState =
  | "known"
  | "free"
  | "included"
  | "not_disclosed"
  | "on_request"
  | "not_applicable";
export interface PriceRange {
  min: number;
  max: number;
  raw: string;
}
export interface Evidence {
  id: string;
  sourceId: string;
  sheet?: string;
  cell?: string;
  rawText: string;
  verification: "source_checked" | "structured_unverified" | "preserve_only";
}
export interface Source {
  id: string;
  title: string;
  path: string | null;
  url: string | null;
  sha256: string | null;
  format: string;
}
export interface PriceTerm {
  id: string;
  category: ServiceCategory;
  subject: string;
  label: string;
  role: "list" | "payable" | "discount" | "surcharge";
  state: PriceState;
  min: number | null;
  max: number | null;
  raw: string;
  basis: "person" | "item" | "package";
  condition: string;
  evidenceId: string;
  sourceId: string;
}
export type PlanningServiceCategory = Extract<
  ServiceCategory,
  "studio" | "dress" | "makeup" | "package" | "other"
>;
/** Compact comparison summary; free/included terms never lower a paid basic price. */
export interface PlanningPriceSummary {
  category: PlanningServiceCategory;
  basis: PriceTerm["basis"];
  unitLabel: string;
  min: number | null;
  max: number | null;
  freeAvailable: boolean;
  includedAvailable: boolean;
}
export interface Offer {
  hall: string;
  meal: PriceRange | null;
  rental: PriceRange | null;
  rentalKind: "rental" | "combined";
  decoration: PriceRange | null;
  guests: number | null;
  condition: string;
  additional: boolean;
  minimumAttendees?: number;
  maximumAttendees?: number;
  evidence?: { sheet?: string; row?: number; column?: number };
}
export interface DocumentItem {
  title: string;
  fields: { label: string; value: string }[];
}
export interface DocumentSection {
  heading: string;
  kind: string;
  items: (string | DocumentItem)[];
}
export interface VendorDocument {
  title: string;
  primary: boolean;
  sourceId?: string;
  sections: DocumentSection[];
}
export interface Vendor {
  id: string;
  name: string;
  kind: VendorKind;
  region: string;
  address: string | null;
  phone: string | null;
  publishedAt: string | null;
  priceYear: number | null;
  archived: boolean;
  latitude: number | null;
  longitude: number | null;
  mealMin: number | null;
  mealMax: number | null;
  rentalMin: number | null;
  guestsMin: number | null;
  packageMin: number | null;
  packageMax: number | null;
  /** Lowest separately published basic service, never a studio+dress+makeup total. */
  serviceMin: number | null;
  serviceMax: number | null;
  categories: ServiceCategory[];
  planningPrices?: PlanningPriceSummary[];
  offers: Offer[];
  priceTerms: PriceTerm[];
  documents: VendorDocument[];
  sources: Source[];
  evidence: Evidence[];
  sourceUrl: string;
  warnings: string[];
  model: {
    schemaVersion: string;
    entityKind: "core:venue" | "core:organization";
    disclosureId: string;
    interpretation: string;
    previousDisclosures?: {
      id: string;
      sourceUrl: string;
      publishedAt: string | null;
    }[];
  };
}
export interface CostEstimate {
  min: number;
  max: number;
  billableGuests: number;
  isPartial: boolean;
  notes: string[];
}
export interface VendorFilters {
  query?: string;
  kind?: VendorKind | "all";
  region?: string;
  minMeal?: number;
  minRental?: number;
  maxRental?: number;
  minBudget?: number;
  maxMeal?: number;
  maxBudget?: number;
  guests?: number;
  onlyPriced?: boolean;
  ids?: string[];
  sort?: "recommended" | "price-asc" | "price-desc" | "name";
}
