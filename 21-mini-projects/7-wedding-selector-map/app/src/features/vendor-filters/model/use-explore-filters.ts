"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Vendor, VendorKind, VendorFilters } from "@/entities/vendor";
import { filterVendors } from "@/entities/vendor";
export interface InitialFilters {
  initialQuery: string;
  initialRegion: string;
  initialKind: VendorKind;
}
export function useExploreFilters(
  vendors: Vendor[],
  initial: InitialFilters,
  favoriteIds: string[],
) {
  const [query, setQuery] = useState(initial.initialQuery);
  const [region, setRegion] = useState(initial.initialRegion);
  const [kind, setKind] = useState<VendorKind>(initial.initialKind);
  const [guests, setGuests] = useState(200);
  const [priceRanges, setPriceRanges] = useState<
    Pick<
      VendorFilters,
      | "minMeal"
      | "maxMeal"
      | "minRental"
      | "maxRental"
      | "minBudget"
      | "maxBudget"
    >
  >({});
  const [budget, setBudget] = useState(0);
  const [onlyPriced, setOnlyPriced] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<VendorFilters["sort"]>("recommended");
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () =>
      filterVendors(vendors, {
        query: deferredQuery,
        region,
        kind,
        guests,
        ...(kind === "venue"
          ? priceRanges
          : { maxBudget: budget || undefined }),
        onlyPriced,
        sort,
        ids: favoritesOnly ? favoriteIds : undefined,
      }),
    [
      vendors,
      deferredQuery,
      region,
      kind,
      guests,
      budget,
      priceRanges,
      onlyPriced,
      sort,
      favoritesOnly,
      favoriteIds,
    ],
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    if (region) url.searchParams.set("region", region);
    else url.searchParams.delete("region");
    url.searchParams.set("kind", kind);
    window.history.replaceState(null, "", url);
  }, [query, region, kind]);
  function reset() {
    setQuery("");
    setRegion("전체");
    setBudget(0);
    setPriceRanges({});
    setOnlyPriced(false);
    setFavoritesOnly(false);
    setSort("recommended");
  }
  function changeKind(next: VendorKind) {
    setKind(next);
    setBudget(0);
    setPriceRanges({});
    setFavoritesOnly(false);
  }
  return {
    priceRanges,
    setPriceRanges,
    query,
    setQuery,
    region,
    setRegion,
    kind,
    setKind: changeKind,
    guests,
    setGuests,
    budget,
    setBudget,
    onlyPriced,
    setOnlyPriced,
    favoritesOnly,
    setFavoritesOnly,
    sort,
    setSort,
    filtered,
    reset,
  };
}
