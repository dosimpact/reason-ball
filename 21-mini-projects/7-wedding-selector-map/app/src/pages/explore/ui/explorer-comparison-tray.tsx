import { ArrowRight, Scale, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerComparisonTrayProps = ExplorerSectionProps<
  "comparisonVendors" | "comparison" | "setCompareOpen"
>;
export function ExplorerComparisonTray({
  comparisonVendors,
  comparison,
  setCompareOpen,
}: ExplorerComparisonTrayProps) {
  return (
    comparisonVendors.length > 0 && (
      <div className="comparison-tray">
        <div className="tray-label">
          <Scale size={20} />
          <div>
            <strong>나란히, 더 명확하게.</strong>
            <span>최대 3곳을 같은 조건으로 비교해요</span>
          </div>
        </div>
        <div className="tray-items">
          {comparisonVendors.map((v) => (
            <div className="tray-chip" key={v.id}>
              <span>{v.name}</span>
              <button
                aria-label={`${v.name} 비교함에서 제거`}
                onClick={() => comparison.toggle(v.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {Array.from({ length: 3 - comparisonVendors.length }, (_, i) => (
            <span className="tray-placeholder" key={i}>
              <PlusSign />
              업체 담기
            </span>
          ))}
        </div>
        <Button onClick={() => setCompareOpen(true)} className="tray-compare">
          {comparisonVendors.length}곳 비교하기 <ArrowRight size={15} />
        </Button>
      </div>
    )
  );
}
function PlusSign() {
  return <span aria-hidden="true">＋</span>;
}
