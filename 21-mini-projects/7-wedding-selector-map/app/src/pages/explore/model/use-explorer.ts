import { useCallback, useEffect, useMemo, useState } from "react";
import type { Vendor, VendorKind } from "@/entities/vendor";
import { useShortlist } from "@/features/shortlist";
import {
  useExploreFilters,
  type InitialFilters,
} from "@/features/vendor-filters";
import { useVendorDetail } from "@/features/vendor-details";
import { useExplorerNotification } from "./use-explorer-notification";

export interface ExplorerProps extends InitialFilters {
  vendors: Vendor[];
}

/** Coordinate page actions; filtering and disclosure loading keep their own lifecycle. */
export function useExplorer({ vendors, ...initial }: ExplorerProps) {
  const favorites = useShortlist("orot:favorites");
  const comparison = useShortlist("orot:comparison", 3);
  const filters = useExploreFilters(vendors, initial, favorites.ids);
  const [visibleCount, setVisibleCount] = useState(24);
  const [mapOnly, setMapOnly] = useState(true);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const updateMapVisibleIds = useCallback((ids: string[]) => {
    setMapVisibleIds((previous) =>
      previous?.join("|") === ids.join("|") ? previous : ids,
    );
    setVisibleCount(24);
  }, []);
  const listFilters = useMemo(
    () => ({
      ...filters,
      filtered:
        mapOnly && mapVisibleIds !== null
          ? filters.filtered.filter((vendor) =>
              mapVisibleIds.includes(vendor.id),
            )
          : filters.filtered,
    }),
    [filters, mapOnly, mapVisibleIds],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [moreFilters, setMoreFilters] = useState(false);
  const { loadedVendor, detailError } = useVendorDetail(selectedId);
  const { toast, notify } = useExplorerNotification();
  const selectedSummary = vendors.find((vendor) => vendor.id === selectedId);
  const selectedVendor =
    loadedVendor?.id === selectedId ? loadedVendor : selectedSummary;
  const comparisonVendors = comparison.ids
    .map((id) => vendors.find((vendor) => vendor.id === id))
    .filter((vendor): vendor is Vendor => !!vendor);
  const regions = useMemo(
    () =>
      [...new Set(vendors.map((vendor) => vendor.region))].sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [vendors],
  );
  const activeCount = [
    filters.budget > 0,
    filters.priceRanges.minMeal != null || filters.priceRanges.maxMeal != null,
    filters.priceRanges.minRental != null ||
      filters.priceRanges.maxRental != null,
    filters.priceRanges.minBudget != null ||
      filters.priceRanges.maxBudget != null,
    filters.onlyPriced,
    filters.favoritesOnly,
  ].filter(Boolean).length;
  const venueCount = vendors.filter((vendor) => vendor.kind === "venue").length;
  const planningCount = vendors.filter(
    (vendor) => vendor.kind === "planning",
  ).length;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCompare(id: string) {
    const removing = comparison.ids.includes(id);
    if (!comparison.toggle(id))
      notify("한 번에 3곳까지 비교할 수 있어요. 비교함에서 한 곳을 빼주세요.");
    else if (!removing)
      notify("비교함에 담았어요. 같은 조건으로 나란히 살펴보세요.");
  }
  function selectVendor(id: string) {
    setSelectedId(id);
  }
  function resetFilters() {
    filters.reset();
    setMapOnly(false);
    setVisibleCount(24);
  }
  function changeKind(kind: VendorKind) {
    filters.setKind(kind);
    setSelectedId(null);
    setVisibleCount(24);
  }
  function showFavorites() {
    filters.setFavoritesOnly(!filters.favoritesOnly);
    setSelectedId(null);
    setVisibleCount(24);
  }

  return {
    mapOnly,
    setMapOnly,
    updateMapVisibleIds,
    listFilters,
    vendors,
    favorites,
    comparison,
    filters,
    selectedId,
    setSelectedId,
    compareOpen,
    setCompareOpen,
    guideOpen,
    setGuideOpen,
    mobileView,
    setMobileView,
    moreFilters,
    setMoreFilters,
    visibleCount,
    setVisibleCount,
    loadedVendor,
    detailError,
    selectedVendor,
    comparisonVendors,
    regions,
    activeCount,
    venueCount,
    planningCount,
    toast,
    toggleCompare,
    selectVendor,
    resetFilters,
    changeKind,
    showFavorites,
  };
}

export type ExplorerModel = ReturnType<typeof useExplorer>;
/** Page-local regions declare only the state and actions they consume. */
export type ExplorerSectionProps<Keys extends keyof ExplorerModel> = Pick<
  ExplorerModel,
  Keys
>;
