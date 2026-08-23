import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatIndexPoints, formatRatioAsPercent } from "@/utils/index-dcf";
import type {
  DcfForecastYearResult,
  DcfResult,
  NodeResult,
  ValidationIssue,
} from "@/utils/index-dcf/types";
import { FlowStep } from "@/widget/index-dcf/FlowStep";
import {
  formatDelta,
  getNodeValue,
  getNodeWarningMessages,
} from "@/widget/index-dcf/node-display";

type ForecastSectionProps = {
  baseline: DcfResult;
  issues: readonly ValidationIssue[];
  view: DcfResult;
};

export function ForecastSection({ baseline, issues, view }: ForecastSectionProps) {
  return (
    <FlowStep
      description="Each year compounds underlying EPS, applies dividend and net buyback payout, then discounts shareholder cash to today."
      id="forecast"
      step={2}
      title="Five-year forecast"
    >
      <div className="mb-4 grid gap-3 @sm/dcf:grid-cols-2">
        <SummaryMetric
          label="Forecast discount rate"
          node={view.forecastDiscountRate}
          formatter={formatRatioAsPercent}
        />
        <SummaryMetric
          baseline={baseline.fiveYearPresentValue}
          label="PV of five-year payouts"
          node={view.fiveYearPresentValue}
          formatter={formatIndexPoints}
        />
      </div>

      <div className="hidden overflow-hidden rounded-md border @5xl/dcf:block">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">
            Five-year EPS, shareholder payout, cash payout, and present value forecast
          </caption>
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground" scope="col">
                Metric
              </th>
              {view.forecast.map((year) => (
                <th className="px-3 py-2 text-right font-semibold" key={year.year} scope="col">
                  Y{year.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ForecastRow formatter={formatRatioAsPercent} label="EPS growth" nodes={view.forecast.map((year) => year.growthRate)} />
            <ForecastRow formatter={formatIndexPoints} label="EPS" nodes={view.forecast.map((year) => year.eps)} />
            <ForecastRow formatter={formatRatioAsPercent} label="Dividend P/O" nodes={view.forecast.map((year) => year.dividendPayoutRate)} />
            <ForecastRow formatter={formatRatioAsPercent} label="Net Buyback P/O" nodes={view.forecast.map((year) => year.buybackPayoutRate)} />
            <ForecastRow formatter={formatRatioAsPercent} label="Total P/O" nodes={view.forecast.map((year) => year.totalPayoutRate)} warnings />
            <ForecastRow formatter={formatIndexPoints} label="Cash Payout" nodes={view.forecast.map((year) => year.cashPayout)} />
            <ForecastRow formatter={formatIndexPoints} label="Present Value" nodes={view.forecast.map((year) => year.presentValue)} />
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 @sm/dcf:grid-cols-2 @3xl/dcf:grid-cols-3 @5xl/dcf:hidden">
        {view.forecast.map((year, index) => (
          <ForecastYearCard
            baseline={baseline.forecast[index]}
            issues={issues}
            key={year.year}
            year={year}
          />
        ))}
      </div>
    </FlowStep>
  );
}

function SummaryMetric({
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
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
        {value === null ? "Calculation unavailable" : formatter(value)}
      </p>
      {value !== null && baseline ? (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
          {formatDelta(value, baselineValue, formatter)}
        </p>
      ) : null}
    </div>
  );
}

function ForecastRow({
  formatter,
  label,
  nodes,
  warnings = false,
}: {
  formatter: (value: number) => string;
  label: string;
  nodes: readonly NodeResult<number>[];
  warnings?: boolean;
}) {
  return (
    <tr className="border-t">
      <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground" scope="row">
        {label}
      </th>
      {nodes.map((node, index) => {
        const value = getNodeValue(node);
        const hasWarning = warnings && node.status === "available" && (node.warningIds?.length ?? 0) > 0;

        return (
          <td className="px-3 py-2 text-right font-mono tabular-nums" key={index}>
            <span className={hasWarning ? "font-semibold text-amber-700 dark:text-amber-400" : undefined}>
              {value === null ? "—" : formatter(value)}
            </span>
            {hasWarning ? <span className="sr-only"> Warning</span> : null}
          </td>
        );
      })}
    </tr>
  );
}

function ForecastYearCard({
  baseline,
  issues,
  year,
}: {
  baseline: DcfForecastYearResult;
  issues: readonly ValidationIssue[];
  year: DcfForecastYearResult;
}) {
  const warnings = getNodeWarningMessages(year.totalPayoutRate, issues);

  return (
    <article className="rounded-md border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Year {year.year}</h3>
        {warnings.length > 0 ? (
          <Badge className="gap-1" variant="outline">
            <AlertTriangle aria-hidden="true" className="text-amber-700 dark:text-amber-400" />
            Warning
          </Badge>
        ) : null}
      </div>
      <dl className="space-y-2 text-xs">
        <YearValue formatter={formatRatioAsPercent} label="Growth" node={year.growthRate} />
        <YearValue baseline={baseline.eps} formatter={formatIndexPoints} label="EPS" node={year.eps} />
        <YearValue formatter={formatRatioAsPercent} label="Dividend P/O" node={year.dividendPayoutRate} />
        <YearValue formatter={formatRatioAsPercent} label="Net Buyback P/O" node={year.buybackPayoutRate} />
        <YearValue formatter={formatRatioAsPercent} label="Total P/O" node={year.totalPayoutRate} />
        <YearValue baseline={baseline.cashPayout} formatter={formatIndexPoints} label="Cash Payout" node={year.cashPayout} />
        <YearValue baseline={baseline.presentValue} formatter={formatIndexPoints} label="Present Value" node={year.presentValue} />
      </dl>
      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t pt-3 text-[0.6875rem] leading-4 text-amber-800 dark:text-amber-300">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function YearValue({
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
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b border-dashed pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono font-medium tabular-nums">
        {value === null ? "Unavailable" : formatter(value)}
      </dd>
      {value !== null && baseline ? (
        <dd className="col-span-2 text-right text-[0.625rem] text-muted-foreground">
          {formatDelta(value, baselineValue, formatter)}
        </dd>
      ) : null}
    </div>
  );
}
