"use client";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useExplorer, type ExplorerProps } from "../model/use-explorer";
import { ExplorerRail } from "./explorer-rail";
import { ExplorerHeader } from "./explorer-header";
import { ExplorerSearch } from "./explorer-search";
import { ExplorerExtendedFilters } from "./explorer-extended-filters";
import { ExplorerHeading } from "./explorer-heading";
import { ExplorerResults } from "./explorer-results";
import { ExplorerMap } from "./explorer-map";
import { ExplorerComparisonTray } from "./explorer-comparison-tray";
import { ExplorerComparisonDialog } from "./explorer-comparison-dialog";
import { ExplorerGuide } from "./explorer-guide";
import "./explorer.css";
export type { ExplorerProps } from "../model/use-explorer";

export function Explorer(props: ExplorerProps) {
  const explorer = useExplorer(props);
  return (
    <div
      className={cn(
        "orot-app map-first",
        `view-${explorer.mobileView}`,
        explorer.selectedVendor && "has-detail",
      )}
    >
      <a href="#explore-results" className="skip-link">
        검색 결과로 건너뛰기
      </a>
      <ExplorerRail {...explorer} />
      <main className="app-body">
        <section
          className="explorer-dock"
          aria-label="업체 탐색 패널"
          id="explore-results"
          tabIndex={-1}
        >
          <ExplorerHeader {...explorer} />
          <ExplorerSearch {...explorer} />
          <ExplorerExtendedFilters {...explorer} />
          <ExplorerHeading {...explorer} />
          <ExplorerResults {...explorer} filters={explorer.listFilters} />
        </section>
        <div className="explore-workspace">
          <ExplorerMap {...explorer} />
        </div>
        <ExplorerComparisonTray {...explorer} />
      </main>
      {explorer.toast && (
        <div className="toast-message" role="status">
          <Check size={16} />
          {explorer.toast}
        </div>
      )}
      <ExplorerComparisonDialog {...explorer} />
      <ExplorerGuide {...explorer} />
    </div>
  );
}
