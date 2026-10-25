import dynamic from "next/dynamic";
import { ArrowRight, Flower2, Layers3 } from "lucide-react";
import { VendorDetail } from "@/widgets/vendor-detail";
const VenueMap = dynamic(() => import("@/widgets/venue-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Flower2 size={30} />
      <span>둘의 시작을 위한 지도를 펼치는 중</span>
    </div>
  ),
});
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerMapProps = ExplorerSectionProps<
  | "updateMapVisibleIds"
  | "filters"
  | "selectedId"
  | "selectVendor"
  | "selectedVendor"
  | "vendors"
  | "favorites"
  | "comparison"
  | "toggleCompare"
  | "setSelectedId"
  | "loadedVendor"
  | "detailError"
>;
export function ExplorerMap({
  filters,
  updateMapVisibleIds,
  selectedId,
  selectVendor,
  selectedVendor,
  vendors,
  favorites,
  comparison,
  toggleCompare,
  setSelectedId,
  loadedVendor,
  detailError,
}: ExplorerMapProps) {
  return (
    <section className="map-panel" aria-label="업체 위치 지도">
      <VenueMap
        onVisibleIdsChange={updateMapVisibleIds}
        vendors={filters.filtered}
        selectedId={selectedId}
        onSelect={selectVendor}
        region={filters.region}
      />
      <div className="map-editorial-label">
        <Layers3 size={15} />
        <span>
          {filters.kind === "venue"
            ? "취향에 맞는 공간을, 지도에서."
            : "함께 준비할 파트너를, 가까이에서."}
        </span>
      </div>
      {!selectedVendor && (
        <div className="map-tip">
          <span>01</span>
          <div>
            <strong>마음에 드는 업체를 눌러보세요</strong>
            <p>공간의 상세 정보와 가격을 한눈에 살펴볼 수 있어요.</p>
          </div>
          <ArrowRight size={18} />
        </div>
      )}
      {selectedVendor && (
        <div className="detail-container" key={selectedVendor.id}>
          <VendorDetail
            vendor={selectedVendor}
            vendors={vendors}
            guests={filters.guests}
            isFavorite={favorites.ids.includes(selectedVendor.id)}
            isCompared={comparison.ids.includes(selectedVendor.id)}
            onFavorite={() => favorites.toggle(selectedVendor.id)}
            onCompare={() => toggleCompare(selectedVendor.id)}
            onClose={() => setSelectedId(null)}
          />
          {loadedVendor?.id !== selectedId && (
            <div className="detail-loading" role="status">
              {detailError
                ? "상세 정보를 불러오지 못했어요. 잠시 후 다시 선택해주세요."
                : "가격과 조건을 불러오는 중…"}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
