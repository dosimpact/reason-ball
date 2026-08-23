"use client";

import { Activity, BookOpen, Database, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { DEMO_INPUT, INPUT_CONSTRAINTS } from "@/constants/index-dcf";
import {
  calculateIndexDcf,
  formatIndexPoints,
  formatSignedPercent,
  setForecastDiscountRateLink,
  synchronizeLinkedLongRunDiscountRate,
  validateIndexDcf,
} from "@/utils/index-dcf";
import type {
  AnnualInputKind,
  DcfInputState,
  FiveYear,
  ScalarNumericInputKey,
} from "@/utils/index-dcf";
import { AssumptionsPanel } from "@/widget/index-dcf/AssumptionsPanel";
import { DiscountTerminalSection } from "@/widget/index-dcf/DiscountTerminalSection";
import { FairValueComposition } from "@/widget/index-dcf/FairValueComposition";
import { FlowConnector } from "@/widget/index-dcf/FlowStep";
import { ForecastSection } from "@/widget/index-dcf/ForecastSection";
import { IssueSummary } from "@/widget/index-dcf/IssueSummary";
import { ValuationComparisonChart } from "@/widget/index-dcf/ValuationComparisonChart";

const demoSnapshot = validateIndexDcf(DEMO_INPUT);
const demoResult = calculateIndexDcf(demoSnapshot);

type ScalarField = ScalarNumericInputKey | "indexName" | "valuationDate";

export function IndexDcfVisualizer() {
  const [input, setInput] = useState<DcfInputState>(() => cloneInput(DEMO_INPUT));
  const snapshot = useMemo(() => validateIndexDcf(input), [input]);
  const result = useMemo(() => calculateIndexDcf(snapshot), [snapshot]);
  const fieldErrors = useMemo(
    () =>
      Object.fromEntries(
        result.issues
          .filter((issue) => issue.severity === "error" && issue.fieldId)
          .map((issue) => [issue.fieldId, issue.message]),
      ),
    [result.issues],
  );

  function handleScalarChange(field: ScalarField, value: string) {
    setInput((current) => {
      const next = { ...current, [field]: value };

      return current.useForecastDiscountRate &&
        (field === "riskFreeRate" || field === "impliedErp")
        ? synchronizeLinkedLongRunDiscountRate(next)
        : next;
    });
  }

  function handleArrayChange(field: AnnualInputKind, index: number, value: string) {
    setInput((current) => {
      const nextValues = [...current[field]] as [string, string, string, string, string];
      nextValues[index] = value;

      return {
        ...current,
        [field]: nextValues,
      };
    });
  }

  function handleToggleLongRunRate(checked: boolean) {
    setInput((current) => setForecastDiscountRateLink(current, checked));
  }

  function handleReset() {
    setInput(cloneInput(DEMO_INPUT));
  }

  return (
    <div className="@container/dcf flex flex-1 flex-col gap-6">
      <header className="border-b pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            <Sparkles aria-hidden="true" data-icon="inline-start" />
            Interactive valuation flow
          </Badge>
          <Badge variant="outline">
            <Database aria-hidden="true" data-icon="inline-start" />
            Manual inputs
          </Badge>
          <Badge variant="outline">
            <BookOpen aria-hidden="true" data-icon="inline-start" />
            Educational model
          </Badge>
        </div>
        <div className="mt-4 max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Index DCF</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            See every assumption flow into Fair Index
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
            Slide earnings growth, shareholder payout, and discount-rate assumptions. The five-year forecast, terminal value, and market comparison update immediately.
          </p>
        </div>
        <div className="mt-4 flex gap-3 rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          <Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>
            The Demo preset is synthetic. Use Actual Index EPS and Current Index from the same provider, divisor, currency, and valuation date. This tool is not investment advice.
          </p>
        </div>
      </header>

      <IssueSummary issues={result.issues} />

      <section aria-labelledby="dcf-flow-title">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground" id="dcf-flow-title">
            Valuation flow
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Follow the numbered steps from raw assumptions to the Current versus Fair comparison.
          </p>
        </div>

        <div className="grid items-start gap-5 @2xl/dcf:grid-cols-2 @5xl/dcf:grid-cols-[20rem_minmax(0,1fr)]">
          <AssumptionsPanel
            constraints={INPUT_CONSTRAINTS}
            errors={fieldErrors}
            input={input}
            linkedLongRunRate={getLinkedLongRunRate(snapshot.fields.forecastDiscountRate)}
            liveSummary={getLiveSummary(result)}
            onArrayChange={handleArrayChange}
            onReset={handleReset}
            onScalarChange={handleScalarChange}
            onToggleLongRunRate={handleToggleLongRunRate}
          />

          <ol className="min-w-0 list-none" start={2}>
            <li>
              <ForecastSection baseline={demoResult} issues={result.issues} view={result} />
              <FlowConnector />
            </li>
            <li>
              <DiscountTerminalSection
                baseline={demoResult}
                issues={result.issues}
                normalizedRoe={snapshot.fields.normalizedRoe}
                perpetualGrowth={snapshot.fields.perpetualGrowth}
                view={result}
              />
              <FlowConnector />
            </li>
            <li>
              <FairValueComposition baseline={demoResult} issues={result.issues} view={result} />
              <FlowConnector />
            </li>
            <li>
              <ValuationComparisonChart issues={result.issues} view={result} />
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}

function cloneInput(input: DcfInputState): DcfInputState {
  return {
    ...input,
    growthRates: [...input.growthRates] as FiveYear<string>,
    dividendPayouts: [...input.dividendPayouts] as FiveYear<string>,
    buybackPayouts: [...input.buybackPayouts] as FiveYear<string>,
  };
}

function getLinkedLongRunRate(
  forecastRate: ReturnType<typeof validateIndexDcf>["fields"]["forecastDiscountRate"],
) {
  return forecastRate.status === "available"
    ? (forecastRate.value * 100).toFixed(2)
    : "";
}

function getLiveSummary(result: ReturnType<typeof calculateIndexDcf>) {
  if (result.comparison.status === "available") {
    const direction = result.comparison.value.upsideDownsidePercent >= 0 ? "Upside" : "Downside";

    return `Fair ${formatIndexPoints(result.comparison.value.fairIndex)} · ${formatSignedPercent(result.comparison.value.upsideDownsidePercent)} ${direction}`;
  }

  if (result.fairIndex.status === "available") {
    return `Fair ${formatIndexPoints(result.fairIndex.value)} · comparison unavailable`;
  }

  return "Calculation unavailable";
}
