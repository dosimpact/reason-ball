import { ArrowDownRight, ArrowUpRight, CircleEqual } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatIndexPoints,
  formatPercent,
  formatSignedIndexPoints,
  formatSignedPercent,
} from "@/utils/index-dcf";
import type { DcfComparisonValue, DcfResult, ValuationStatus, ValidationIssue } from "@/utils/index-dcf/types";
import { CalculationUnavailable, FlowStep } from "@/widget/index-dcf/FlowStep";
import { getNodeIssueMessages, getNodeValue } from "@/widget/index-dcf/node-display";

type ValuationComparisonChartProps = {
  issues: readonly ValidationIssue[];
  view: DcfResult;
};

export function ValuationComparisonChart({ issues, view }: ValuationComparisonChartProps) {
  const comparison = getNodeValue(view.comparison);

  return (
    <FlowStep
      description="Compare Current and Fair on one zero-based scale, then report both market-based upside and fair-value-based premium or discount."
      id="market-comparison"
      step={5}
      title="Market comparison"
    >
      {comparison === null ? (
        <CalculationUnavailable reasons={getNodeIssueMessages(view.comparison, issues)} />
      ) : (
        <ComparisonContent comparison={comparison} />
      )}
    </FlowStep>
  );
}

function ComparisonContent({ comparison }: { comparison: DcfComparisonValue }) {
  const status = getStatusPresentation(comparison.status);
  const StatusIcon = status.icon;
  const upsideLabel = comparison.upsideDownsidePercent >= 0 ? "Upside" : "Downside";
  const fairRelativeLabel =
    comparison.premiumDiscountToFairPercent >= 0
      ? "Premium to Fair"
      : "Discount to Fair";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-4">
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
            DCF valuation status
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold">
            <StatusIcon aria-hidden="true" className="size-5" />
            {status.label}
            <span className="text-sm font-medium text-muted-foreground" lang="ko">
              {status.koreanLabel}
            </span>
          </div>
        </div>
        <Badge className={status.badgeClassName} variant="outline">
          {formatSignedPercent(comparison.upsideDownsidePercent)} {upsideLabel}
        </Badge>
      </div>

      <figure className="mt-4 rounded-md border bg-background p-3 @sm/dcf:p-4">
        <figcaption className="mb-3">
          <span className="block text-sm font-semibold text-foreground">Current vs Fair Index</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            Both bars start at zero and use the same linear scale.
          </span>
        </figcaption>
        <ComparisonSvg comparison={comparison} />
      </figure>

      <dl className="mt-4 grid gap-3 @sm/dcf:grid-cols-2 @3xl/dcf:grid-cols-3">
        <OutputMetric label="Current Index" value={formatIndexPoints(comparison.currentIndex)} />
        <OutputMetric label="Fair Index" value={formatIndexPoints(comparison.fairIndex)} accent />
        <OutputMetric
          label="Valuation Gap"
          value={formatSignedIndexPoints(comparison.valuationGap)}
        />
        <OutputMetric
          description="(Fair ÷ Current − 1) × 100"
          label="Upside/Downside"
          value={formatSignedPercent(comparison.upsideDownsidePercent)}
        />
        <OutputMetric
          description="(Current ÷ Fair − 1) × 100"
          label="Premium/Discount to Fair"
          value={`${formatPercent(Math.abs(comparison.premiumDiscountToFairPercent))} ${fairRelativeLabel}`}
        />
        <OutputMetric label="Valuation status" value={`${status.label} · ${status.koreanLabel}`} />
      </dl>
    </>
  );
}

function ComparisonSvg({ comparison }: { comparison: DcfComparisonValue }) {
  const chartMax = Math.max(comparison.currentIndex, comparison.fairIndex);
  const plotWidth = 430;
  const currentWidth = (comparison.currentIndex / chartMax) * plotWidth;
  const fairWidth = (comparison.fairIndex / chartMax) * plotWidth;
  const accessibleName = `Current Index ${formatIndexPoints(comparison.currentIndex)}; Fair Index ${formatIndexPoints(comparison.fairIndex)}; ${getStatusPresentation(comparison.status).label}; ${formatSignedPercent(comparison.upsideDownsidePercent)} ${comparison.upsideDownsidePercent >= 0 ? "Upside" : "Downside"}`;

  return (
    <svg
      aria-label={accessibleName}
      className="h-auto w-full text-foreground"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox="0 0 680 230"
    >
      <title>Current and Fair Index comparison</title>
      <desc>{accessibleName}. Bars share a zero baseline and linear scale.</desc>
      <defs>
        <pattern height="8" id="current-index-pattern" patternUnits="userSpaceOnUse" width="8">
          <rect fill="var(--muted)" height="8" width="8" />
          <path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="var(--muted-foreground)" strokeOpacity="0.35" strokeWidth="2" />
        </pattern>
      </defs>

      <line stroke="var(--border)" strokeWidth="2" x1="170" x2="170" y1="36" y2="180" />
      <text fill="currentColor" fontSize="14" fontWeight="600" textAnchor="end" x="154" y="77">
        Current Index
      </text>
      <rect
        fill="url(#current-index-pattern)"
        height="34"
        rx="5"
        stroke="var(--muted-foreground)"
        strokeWidth="2"
        width={currentWidth}
        x="170"
        y="53"
      />
      <text fill="currentColor" fontFamily="monospace" fontSize="14" fontWeight="600" x="180" y="76">
        {formatIndexPoints(comparison.currentIndex)}
      </text>

      <text fill="currentColor" fontSize="14" fontWeight="600" textAnchor="end" x="154" y="147">
        Fair Index
      </text>
      <rect
        fill="var(--chart-4)"
        height="34"
        rx="5"
        stroke="var(--foreground)"
        strokeWidth="2"
        width={fairWidth}
        x="170"
        y="123"
      />
      <text fill="var(--primary-foreground)" fontFamily="monospace" fontSize="14" fontWeight="700" x="180" y="146">
        {formatIndexPoints(comparison.fairIndex)}
      </text>

      <text fill="var(--muted-foreground)" fontSize="12" textAnchor="middle" x="170" y="204">
        0
      </text>
      <text fill="var(--muted-foreground)" fontSize="12" textAnchor="end" x="600" y="204">
        {formatIndexPoints(chartMax)}
      </text>
    </svg>
  );
}

function OutputMetric({
  accent = false,
  description,
  label,
  value,
}: {
  label: string;
  value: string;
  accent?: boolean;
  description?: string;
}) {
  return (
    <div className={accent ? "rounded-md border border-primary/30 bg-primary/5 p-3" : "rounded-md border p-3"}>
      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <output aria-label={label} className="font-mono text-sm font-semibold tabular-nums">
          {value}
        </output>
      </dd>
      {description ? <dd className="mt-1 text-[0.625rem] text-muted-foreground">{description}</dd> : null}
    </div>
  );
}

function getStatusPresentation(status: ValuationStatus) {
  if (status === "undervalued") {
    return {
      badgeClassName: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
      icon: ArrowUpRight,
      label: "Undervalued",
      koreanLabel: "저평가",
    };
  }

  if (status === "overvalued") {
    return {
      badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: ArrowDownRight,
      label: "Overvalued",
      koreanLabel: "고평가",
    };
  }

  return {
    badgeClassName: "border-border bg-muted text-foreground",
    icon: CircleEqual,
    label: "Fairly valued",
    koreanLabel: "적정가",
  };
}
