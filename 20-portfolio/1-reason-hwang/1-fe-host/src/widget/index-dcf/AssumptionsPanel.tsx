import { RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AnnualInputKind,
  DcfInputState,
  InputConstraints,
  ScalarNumericInputKey,
} from "@/utils/index-dcf/types";
import { AssumptionControl } from "@/widget/index-dcf/AssumptionControl";
import { FlowStep } from "@/widget/index-dcf/FlowStep";

type ScalarField = ScalarNumericInputKey | "indexName" | "valuationDate";

type AssumptionsPanelProps = {
  constraints: InputConstraints;
  errors: Readonly<Record<string, string | undefined>>;
  input: DcfInputState;
  linkedLongRunRate: string;
  liveSummary: string;
  onArrayChange: (field: AnnualInputKind, index: number, value: string) => void;
  onReset: () => void;
  onScalarChange: (field: ScalarField, value: string) => void;
  onToggleLongRunRate: (checked: boolean) => void;
};

const years = [1, 2, 3, 4, 5] as const;

export function AssumptionsPanel({
  constraints,
  errors,
  input,
  linkedLongRunRate,
  liveSummary,
  onArrayChange,
  onReset,
  onScalarChange,
  onToggleLongRunRate,
}: AssumptionsPanelProps) {
  return (
    <FlowStep
      description="Set one consistent valuation date, index basis, and the assumptions that feed every downstream node."
      id="assumptions"
      step={1}
      title="Context & assumptions"
    >
      <form
        aria-label="Index DCF assumptions"
        className="space-y-6"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-md border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <output aria-label="Live valuation summary" aria-live="polite" className="min-w-0">
            <span className="block text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              Live result
            </span>
            <span className="block truncate text-xs font-semibold text-foreground">
              {liveSummary}
            </span>
          </output>
          <Button onClick={onReset} size="sm" type="button" variant="outline">
            <RotateCcw data-icon="inline-start" />
            Reset Demo
          </Button>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Model context</legend>
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="indexName">
              Index Name
            </label>
            <Input
              aria-describedby={errors.indexName ? "indexName-help indexName-error" : "indexName-help"}
              aria-invalid={Boolean(errors.indexName)}
              id="indexName"
              onChange={(event) => onScalarChange("indexName", event.target.value)}
              value={input.indexName}
            />
            <p className="text-[0.6875rem] leading-4 text-muted-foreground" id="indexName-help">
              Demo inputs are synthetic and are not market data or investment advice.
            </p>
            {errors.indexName ? (
              <p className="text-[0.6875rem] font-medium text-destructive" id="indexName-error">
                {errors.indexName}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="valuationDate">
              Valuation As-of Date
            </label>
            <Input
              aria-describedby={errors.valuationDate ? "valuationDate-error" : undefined}
              aria-invalid={Boolean(errors.valuationDate)}
              id="valuationDate"
              onChange={(event) => onScalarChange("valuationDate", event.target.value)}
              type="date"
              value={input.valuationDate}
            />
            {errors.valuationDate ? (
              <p className="text-[0.6875rem] font-medium text-destructive" id="valuationDate-error">
                {errors.valuationDate}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">EPS basis: TTM</Badge>
            <Badge variant="outline">Unit: index points</Badge>
            <Badge variant="outline">Broad-market beta: 1</Badge>
          </div>
          <AssumptionControl
            {...constraints.actualEps}
            description="TTM earnings points from the same provider and divisor as the current index."
            error={errors.actualEps}
            id="actualEps"
            label="Actual Index EPS"
            onChange={(value) => onScalarChange("actualEps", value)}
            unit="index points"
            value={input.actualEps}
          />
          <AssumptionControl
            {...constraints.currentIndex}
            description="Same-date close using the same index provider and divisor."
            error={errors.currentIndex}
            id="currentIndex"
            label="Current Index"
            onChange={(value) => onScalarChange("currentIndex", value)}
            unit="index points"
            value={input.currentIndex}
          />
        </fieldset>

        <fieldset className="space-y-4 border-t pt-5">
          <legend className="px-1 text-sm font-semibold text-foreground">Five-year EPS growth</legend>
          <p className="text-xs leading-5 text-muted-foreground">
            Enter underlying earnings growth before any additional accretion from future buybacks.
          </p>
          {years.map((year, index) => (
            <AssumptionControl
            {...constraints.growthRates}
              error={errors[`growthRates.${index}`]}
              id={`growthRates-${index}`}
              key={year}
              label={`EPS Growth Y${year}`}
              onChange={(value) => onArrayChange("growthRates", index, value)}
              unit="%"
              value={input.growthRates[index]}
            />
          ))}
        </fieldset>

        <fieldset className="space-y-4 border-t pt-5">
          <legend className="px-1 text-sm font-semibold text-foreground">Five-year shareholder payout</legend>
          {years.map((year, index) => (
            <div className="space-y-4 rounded-md border bg-muted/20 p-3" key={year}>
              <p className="text-xs font-semibold text-foreground">Year {year}</p>
              <AssumptionControl
                {...constraints.dividendPayouts}
                error={errors[`dividendPayouts.${index}`]}
                id={`dividendPayouts-${index}`}
                label={`Dividend P/O Y${year}`}
                onChange={(value) => onArrayChange("dividendPayouts", index, value)}
                unit="%"
                value={input.dividendPayouts[index]}
              />
              <AssumptionControl
                {...constraints.buybackPayouts}
                description="Negative values represent net share issuance."
                error={errors[`buybackPayouts.${index}`]}
                id={`buybackPayouts-${index}`}
                label={`Net Buyback P/O Y${year}`}
                onChange={(value) => onArrayChange("buybackPayouts", index, value)}
                unit="%"
                value={input.buybackPayouts[index]}
              />
            </div>
          ))}
        </fieldset>

        <fieldset className="space-y-4 border-t pt-5">
          <legend className="px-1 text-sm font-semibold text-foreground">Discount rate</legend>
          <AssumptionControl
            {...constraints.riskFreeRate}
            error={errors.riskFreeRate}
            id="riskFreeRate"
            label="Risk-free Rate"
            onChange={(value) => onScalarChange("riskFreeRate", value)}
            unit="%"
            value={input.riskFreeRate}
          />
          <AssumptionControl
            {...constraints.impliedErp}
            error={errors.impliedErp}
            id="impliedErp"
            label="Implied ERP"
            onChange={(value) => onScalarChange("impliedErp", value)}
            unit="%"
            value={input.impliedErp}
          />
        </fieldset>

        <fieldset className="space-y-4 border-t pt-5">
          <legend className="px-1 text-sm font-semibold text-foreground">Terminal assumptions</legend>
          <AssumptionControl
            {...constraints.perpetualGrowth}
            error={errors.perpetualGrowth}
            id="perpetualGrowth"
            label="Perpetual Growth"
            onChange={(value) => onScalarChange("perpetualGrowth", value)}
            unit="%"
            value={input.perpetualGrowth}
          />
          <AssumptionControl
            {...constraints.normalizedRoe}
            error={errors.normalizedRoe}
            id="normalizedRoe"
            label="Long-run Normalized ROE"
            onChange={(value) => onScalarChange("normalizedRoe", value)}
            unit="%"
            value={input.normalizedRoe}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-muted/20 p-3">
            <input
              checked={input.useForecastDiscountRate}
              className="mt-0.5 size-4 accent-primary"
              onChange={(event) => onToggleLongRunRate(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-xs font-medium text-foreground">
                Use Forecast Discount Rate
              </span>
              <span className="mt-1 block text-[0.6875rem] leading-4 text-muted-foreground">
                Link the long-run discount rate to Risk-free Rate + Implied ERP.
              </span>
            </span>
          </label>

          <AssumptionControl
            {...constraints.independentLongRunDiscountRate}
            disabled={input.useForecastDiscountRate}
            error={errors.independentLongRunDiscountRate}
            id="independentLongRunDiscountRate"
            label="Long-run Discount Rate"
            onChange={(value) => onScalarChange("independentLongRunDiscountRate", value)}
            unit="%"
            value={
              input.useForecastDiscountRate
                ? linkedLongRunRate
                : input.independentLongRunDiscountRate
            }
          />
        </fieldset>
      </form>
    </FlowStep>
  );
}
