import { ArrowRight } from "lucide-react";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerFooterProps = ExplorerSectionProps<"setGuideOpen">;
export function ExplorerFooter({ setGuideOpen }: ExplorerFooterProps) {
  return (
    <footer className="site-footer">
      <span>오롯, 둘만의 기준을 찾아가는 여정.</span>
      <button onClick={() => setGuideOpen(true)}>
        가격 비교 가이드 <ArrowUpRightIcon />
      </button>
      <span>© OROT WEDDING ATLAS</span>
    </footer>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={11} style={{ transform: "rotate(-35deg)" }} />;
}
