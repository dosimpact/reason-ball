import { AlertTriangle, Equal, Plus } from "lucide-react";

import { formatIndexPoints, formatPercent } from "@/utils/index-dcf";
import type { DcfResult, NodeResult, ValidationIssue } from "@/utils/index-dcf/types";
import {
  CalculationUnavailable,
  FlowStep,
  Metric,
} from "@/widget/index-dcf/FlowStep";
import {
  formatDelta,
  getNodeIssueMessages,
  getNodeValue,
  getNodeWarningMessages,
} from "@/widget/index-dcf/node-display";

type FairValueCompositionProps = {
  baseline: DcfResult;
  issues: readonly ValidationIssue[];
  view: DcfResult;
};

export function FairValueComposition({ baseline, issues, view }: FairValueCompositionProps) {
  const fairValue = getNodeValue(view.fairIndex);
  const terminalShare = getNodeValue(view.terminal.shareOfFairIndexPercent);
  const warnings = getNodeWarningMessages(view.terminal.shareOfFairIndexPercent, issues);

  return (
    <FlowStep
      description="Combine explicit shareholder payouts with the discounted value of all normalized payouts after Year 5."
      id="fair-composition"
      step={4}
      title="Fair index composition"
    >
      {fairValue === null ? (
        <CalculationUnavailable reasons={getNodeIssueMessages(view.fairIndex, issues)} />
      ) : (
        <>
          <dl className="grid items-stretch gap-3 @sm/dcf:grid-cols-[1fr_auto_1fr_auto_1fr] @sm/dcf:items-center">
            <NodeCompositionMetric
              baseline={baseline.fiveYearPresentValue}
              label="PV of Y1–Y5"
              node={view.fiveYearPresentValue}
            />
            <Plus aria-hidden="true" className="mx-auto hidden size-5 text-muted-foreground @sm/dcf:block" />
            <NodeCompositionMetric
              baseline={baseline.terminal.presentValue}
              label="PV of Terminal"
              node={view.terminal.presentValue}
            />
            <Equal aria-hidden="true" className="mx-auto hidden size-5 text-muted-foreground @sm/dcf:block" />
            <Metric
              accent
              delta={formatDelta(fairValue, getNodeValue(baseline.fairIndex), formatIndexPoints)}
              label="Fair Index"
              value={formatIndexPoints(fairValue)}
            />
          </dl>

          {terminalShare !== null ? (
            <div className="mt-4 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-foreground">Terminal Value share of Fair Index</span>
                <span className="font-mono font-semibold tabular-nums">{formatPercent(terminalShare)}</span>
              </div>
              <div
                aria-label={`Terminal Value represents ${formatPercent(terminalShare)} of Fair Index`}
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                role="img"
              >
                <div
                  className="h-full rounded-full bg-chart-3"
                  style={{ width: `${Math.min(100, Math.max(0, terminalShare))}%` }}
                />
              </div>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="mt-3 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{warnings.join(" ")}</span>
            </div>
          ) : null}
        </>
      )}
    </FlowStep>
  );
}

function NodeCompositionMetric({
  baseline,
  label,
  node,
}: {
  baseline: NodeResult<number>;
  label: string;
  node: NodeResult<number>;
}) {
  const value = getNodeValue(node);

  return (
    <Metric
      delta={value === null ? undefined : formatDelta(value, getNodeValue(baseline), formatIndexPoints)}
      label={label}
      value={value === null ? "Calculation unavailable" : formatIndexPoints(value)}
    />
  );
}
