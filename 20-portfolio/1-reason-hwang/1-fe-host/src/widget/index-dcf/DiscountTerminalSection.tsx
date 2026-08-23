import { AlertTriangle, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatIndexPoints, formatRatioAsPercent } from "@/utils/index-dcf";
import type {
  DcfResult,
  NodeResult,
  ValidationIssue,
} from "@/utils/index-dcf/types";
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

type DiscountTerminalSectionProps = {
  baseline: DcfResult;
  issues: readonly ValidationIssue[];
  normalizedRoe: NodeResult<number>;
  perpetualGrowth: NodeResult<number>;
  view: DcfResult;
};

export function DiscountTerminalSection({
  baseline,
  issues,
  normalizedRoe,
  perpetualGrowth,
  view,
}: DiscountTerminalSectionProps) {
  const terminalWarnings = unique([
    ...getNodeWarningMessages(view.terminal.terminalValueAtY5, issues),
    ...getNodeWarningMessages(view.terminal.shareOfFairIndexPercent, issues),
  ]);

  return (
    <FlowStep
      description="Discount five explicit years, then transition immediately from Y5 assumptions to a normalized Y6 perpetuity."
      id="terminal"
      step={3}
      title="Discount & terminal value"
    >
      <div className="grid gap-4 @2xl/dcf:grid-cols-2">
        <section aria-labelledby="forecast-discount-title" className="rounded-md border bg-muted/20 p-4">
          <h3 className="text-sm font-semibold" id="forecast-discount-title">
            Forecast period
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Cash payouts arrive at each year end and are discounted using r.
          </p>
          <dl className="mt-4 grid gap-3">
            <NodeMetric formatter={formatRatioAsPercent} label="Discount rate r" node={view.forecastDiscountRate} />
            <NodeMetric
              baseline={baseline.fiveYearPresentValue}
              formatter={formatIndexPoints}
              label="PV of Y1–Y5 payouts"
              node={view.fiveYearPresentValue}
            />
          </dl>
        </section>

        <section aria-labelledby="terminal-bridge-title" className="rounded-md border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold" id="terminal-bridge-title">
              Y5 → normalized Y6
            </h3>
            <Badge variant="outline">Immediate transition</Badge>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <BridgeValue label="Y5 EPS" node={view.forecast[4].eps} formatter={formatIndexPoints} />
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
            <BridgeValue label="Y6 EPS" node={view.terminal.epsY6} formatter={formatIndexPoints} />
            <BridgeValue label="Y5 growth" node={view.forecast[4].growthRate} formatter={formatRatioAsPercent} />
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
            <BridgeValue label="Perpetual g" node={perpetualGrowth} formatter={formatRatioAsPercent} />
            <BridgeValue label="Y5 Total P/O" node={view.forecast[4].totalPayoutRate} formatter={formatRatioAsPercent} />
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
            <BridgeValue label="Long-run Payout" node={view.terminal.longRunPayout} formatter={formatRatioAsPercent} />
          </div>
          <dl className="mt-4 grid gap-3 border-t pt-4">
            <NodeMetric formatter={formatRatioAsPercent} label="Normalized ROE" node={normalizedRoe} />
            <NodeMetric formatter={formatRatioAsPercent} label="Long-run discount rate" node={view.terminal.longRunDiscountRate} />
          </dl>
        </section>
      </div>

      <div className="mt-4">
        {view.terminal.terminalValueAtY5.status === "unavailable" ? (
          <CalculationUnavailable
            reasons={getNodeIssueMessages(view.terminal.terminalValueAtY5, issues)}
          />
        ) : (
          <dl className="grid gap-3 @sm/dcf:grid-cols-2 @3xl/dcf:grid-cols-3">
            <NodeMetric
              baseline={baseline.terminal.cashPayoutY6}
              formatter={formatIndexPoints}
              label="Cash Payout Y6"
              node={view.terminal.cashPayoutY6}
            />
            <NodeMetric
              baseline={baseline.terminal.terminalValueAtY5}
              formatter={formatIndexPoints}
              label="Terminal Value at Y5"
              node={view.terminal.terminalValueAtY5}
            />
            <NodeMetric
              baseline={baseline.terminal.presentValue}
              formatter={formatIndexPoints}
              label="PV of Terminal Value"
              node={view.terminal.presentValue}
            />
          </dl>
        )}
      </div>

      {terminalWarnings.length > 0 ? (
        <aside className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Terminal sensitivity warning
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-5">
            {terminalWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </FlowStep>
  );
}

function NodeMetric({
  baseline,
  formatter,
  label,
  node,
}: {
  formatter: (value: number) => string;
  label: string;
  node: NodeResult<number>;
  baseline?: NodeResult<number>;
}) {
  const value = getNodeValue(node);
  const baselineValue = baseline ? getNodeValue(baseline) : null;

  return (
    <Metric
      delta={value === null || !baseline ? undefined : formatDelta(value, baselineValue, formatter)}
      label={label}
      value={value === null ? "Calculation unavailable" : formatter(value)}
      warning={node.status === "available" && node.warningIds.length > 0}
    />
  );
}

function BridgeValue({
  formatter,
  label,
  node,
}: {
  formatter: (value: number) => string;
  label: string;
  node: NodeResult<number>;
}) {
  const value = getNodeValue(node);

  return (
    <div className="min-w-0 rounded-md bg-background p-2 text-center ring-1 ring-foreground/10">
      <p className="truncate text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-semibold tabular-nums">
        {value === null ? "Unavailable" : formatter(value)}
      </p>
    </div>
  );
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}
