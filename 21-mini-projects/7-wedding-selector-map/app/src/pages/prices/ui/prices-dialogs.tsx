import { ArrowRight, Info } from "lucide-react";
import { VendorDetail } from "@/widgets/vendor-detail";
import { VendorComparison } from "@/widgets/vendor-comparison";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type {
  PriceBrowser,
  PriceBrowserProps,
} from "../model/use-price-browser";
type DetailProps = PriceBrowserProps<
  | "selectedVendor"
  | "selectedId"
  | "loadedVendor"
  | "detailError"
  | "closeDetail"
  | "vendors"
  | "filters"
  | "favorites"
  | "comparison"
  | "toggleCompare"
>;
export function PricesDetail({
  selectedVendor,
  selectedId,
  loadedVendor,
  detailError,
  closeDetail,
  vendors,
  filters,
  favorites,
  comparison,
  toggleCompare,
}: DetailProps) {
  if (!selectedVendor) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDetail();
      }}
    >
      <DialogContent className="prices-detail-dialog" showCloseButton={false}>
        <DialogTitle className="sr-only">
          {selectedVendor.name} 가격 상세
        </DialogTitle>
        <DialogDescription className="sr-only">
          선택한 업체의 가격 구성과 적용 조건을 확인하세요.
        </DialogDescription>
        <VendorDetail
          vendor={selectedVendor}
          vendors={vendors}
          guests={filters.guests}
          isFavorite={favorites.ids.includes(selectedVendor.id)}
          isCompared={comparison.ids.includes(selectedVendor.id)}
          onFavorite={() => favorites.toggle(selectedVendor.id)}
          onCompare={() => toggleCompare(selectedVendor.id)}
          onClose={closeDetail}
        />
        {loadedVendor?.id !== selectedId && (
          <p className="prices-detail-loading" role="status">
            {detailError
              ? "상세 정보를 불러오지 못했어요. 잠시 후 다시 선택해주세요."
              : "가격과 조건을 불러오는 중…"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
type ComparisonProps = PriceBrowserProps<
  | "compareOpen"
  | "setCompareOpen"
  | "comparisonVendors"
  | "comparison"
  | "filters"
  | "updateFilters"
>;
export function PricesCompare({
  compareOpen,
  setCompareOpen,
  comparisonVendors,
  comparison,
  filters,
  updateFilters,
}: ComparisonProps) {
  if (!compareOpen) return null;
  return comparisonVendors.length ? (
    <VendorComparison
      vendors={comparisonVendors}
      guests={filters.guests}
      onGuestsChange={(guests) => updateFilters({ guests })}
      onRemove={comparison.toggle}
      onClose={() => setCompareOpen(false)}
    />
  ) : (
    <Dialog open onOpenChange={setCompareOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>마음에 드는 업체를 담아보세요</DialogTitle>
          <DialogDescription>
            가격표의 비교 체크박스로 최대 3곳을 고를 수 있어요. 같은 기준으로
            가격과 조건을 나란히 보여드릴게요.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={() => setCompareOpen(false)}>
          가격표 살펴보기 <ArrowRight size={14} />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function PricesGuide({
  guideOpen,
  setGuideOpen,
}: Pick<PriceBrowser, "guideOpen" | "setGuideOpen">) {
  return (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent className="prices-guide">
        <DialogHeader>
          <p className="prices-eyebrow">A SMALL GUIDE TO A CLEARER CHOICE</p>
          <DialogTitle>같은 기준으로, 더 선명하게.</DialogTitle>
          <DialogDescription>
            가격표를 읽는 데 필요한 네 가지 기준이에요.
          </DialogDescription>
        </DialogHeader>
        <div className="prices-guide-grid">
          <article>
            <span>01</span>
            <h3>한 줄은 같은 홀·같은 조건</h3>
            <p>
              표의 식대·대관·보증인원은 참고비용 계산에 선택한 한 홀의
              조건입니다. 적용 가능한 조건 중 가장 낮은 참고액을 표시해요.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>하객과 보증인원을 함께</h3>
            <p>
              선택한 하객 수보다 보증인원이 크면 보증인원으로 식대를 계산해요.
              미확인 대관료와 장식·필수 옵션은 확정 합계에 포함되지 않습니다.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>상품과 단위를 맞추기</h3>
            <p>
              준비대행은 한 상품과 산정 단위씩 비교합니다. 스튜디오 상품과
              메이크업 1인 가격, 패키지를 합치거나 서로 대체하지 않아요.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>후보를 고르고 함께 살펴보기</h3>
            <p>
              하트는 지도 탐색과 공유되는 저장 기능이에요. 3곳을 체크해
              비교하거나, 현재 필터의 전체 결과를 CSV로 저장할 수 있어요.
            </p>
          </article>
        </div>
        <p className="prices-guide-note">
          <Info size={14} />
          공시 기준 참고금액이며 최종 예약 견적은 업체와 확인해주세요.
        </p>
      </DialogContent>
    </Dialog>
  );
}
