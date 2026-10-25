import { ArrowRight } from "lucide-react";
import { VendorComparison } from "@/widgets/vendor-comparison";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerComparisonDialogProps = ExplorerSectionProps<
  | "compareOpen"
  | "comparisonVendors"
  | "filters"
  | "comparison"
  | "setCompareOpen"
>;
export function ExplorerComparisonDialog({
  compareOpen,
  comparisonVendors,
  filters,
  comparison,
  setCompareOpen,
}: ExplorerComparisonDialogProps) {
  return (
    compareOpen &&
    (comparisonVendors.length > 0 ? (
      <VendorComparison
        vendors={comparisonVendors}
        guests={filters.guests}
        onGuestsChange={filters.setGuests}
        onRemove={comparison.toggle}
        onClose={() => setCompareOpen(false)}
      />
    ) : (
      <Dialog open onOpenChange={setCompareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>우리만의 후보를 비교해보세요</DialogTitle>
            <DialogDescription>
              업체 카드의 ‘비교하기’를 눌러 최대 3곳을 담아주세요. 같은 하객
              수로 공개비용을 나란히 확인할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setCompareOpen(false)}>
            업체 둘러보기 <ArrowRight size={15} />
          </Button>
        </DialogContent>
      </Dialog>
    ))
  );
}
