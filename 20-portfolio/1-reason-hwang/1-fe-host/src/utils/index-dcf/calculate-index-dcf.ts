import {
  FORECAST_YEARS,
  TERMINAL_SHARE_WARNING_PERCENT,
  VALUATION_STATUS_EPSILON_PERCENT,
} from "../../constants/index-dcf";
import {
  available,
  inheritedIssueIds,
  inheritedWarningIds,
  unavailable,
} from "./node-result";
import type {
  DcfForecastYearResult,
  DcfNodeId,
  DcfResult,
  FiveYear,
  ForecastYear,
  NodeResult,
  ValidationIssue,
  ValidationSnapshot,
  ValuationStatus,
} from "./types";

function deriveNumber(
  dependencies: readonly NodeResult<number>[],
  calculate: (values: readonly number[]) => number,
): NodeResult<number> {
  const issueIds = inheritedIssueIds(dependencies);

  if (issueIds.length > 0) {
    return unavailable(issueIds);
  }

  const values: number[] = [];
  for (const dependency of dependencies) {
    if (dependency.status !== "available") {
      return unavailable(inheritedIssueIds(dependencies));
    }
    values.push(dependency.value);
  }

  return available(calculate(values), inheritedWarningIds(dependencies));
}

function addNodeWarning(
  issues: ValidationIssue[],
  issue: ValidationIssue,
): string {
  if (!issues.some((candidate) => candidate.id === issue.id)) {
    issues.push(issue);
  }
  return issue.id;
}

function withWarning<T>(result: NodeResult<T>, warningId: string): NodeResult<T> {
  if (result.status === "unavailable") {
    return result;
  }

  return available(result.value, [...result.warningIds, warningId]);
}

function totalPayoutRate(
  dividend: NodeResult<number>,
  buyback: NodeResult<number>,
  year: ForecastYear,
  issues: ValidationIssue[],
): NodeResult<number> {
  const result = deriveNumber([dividend, buyback], ([dividendRate, buybackRate]) =>
    dividendRate + buybackRate,
  );

  if (
    result.status === "available" &&
    (result.value < 0 || result.value > 1)
  ) {
    const id = addNodeWarning(issues, {
      id: `node:total-payout:y${year}:outside-normal-range`,
      code: "TOTAL_PAYOUT_OUTSIDE_NORMAL_RANGE",
      severity: "warning",
      nodeId: `forecast.${year}.totalPayout`,
      message: `Y${year} Total P/O is outside the 0% to 100% normal range. Calculation continues because net issuance or payout above earnings can occur.`,
    });
    return withWarning(result, id);
  }

  return result;
}

function buildForecastYear(
  year: ForecastYear,
  previousEps: NodeResult<number>,
  growthRate: NodeResult<number>,
  dividendPayoutRate: NodeResult<number>,
  buybackPayoutRate: NodeResult<number>,
  discountRate: NodeResult<number>,
  issues: ValidationIssue[],
): DcfForecastYearResult {
  const eps = deriveNumber([previousEps, growthRate], ([previous, growth]) =>
    previous * (1 + growth),
  );
  const totalPayout = totalPayoutRate(
    dividendPayoutRate,
    buybackPayoutRate,
    year,
    issues,
  );
  const cashPayout = deriveNumber([eps, totalPayout], ([epsValue, payout]) =>
    epsValue * payout,
  );
  const presentValue = deriveNumber(
    [cashPayout, discountRate],
    ([cash, rate]) => cash / (1 + rate) ** year,
  );

  return {
    year,
    growthRate,
    eps,
    dividendPayoutRate,
    buybackPayoutRate,
    totalPayoutRate: totalPayout,
    cashPayout,
    presentValue,
  };
}

function valuationStatus(upsideDownsidePercent: number): ValuationStatus {
  if (upsideDownsidePercent >= VALUATION_STATUS_EPSILON_PERCENT) {
    return "undervalued";
  }
  if (upsideDownsidePercent <= -VALUATION_STATUS_EPSILON_PERCENT) {
    return "overvalued";
  }
  return "fair";
}

function addFairIndexError(issues: ValidationIssue[]): ValidationIssue {
  const existing = issues.find(
    (issue) => issue.code === "NON_POSITIVE_FAIR_INDEX",
  );
  if (existing) {
    return existing;
  }

  const issue: ValidationIssue = {
    id: "node:comparison:non-positive-fair-index",
    code: "NON_POSITIVE_FAIR_INDEX",
    severity: "error",
    nodeId: "comparison",
    message:
      "Fair Index must be greater than zero before market comparison is available.",
  };
  issues.push(issue);
  return issue;
}

export function calculateIndexDcf(snapshot: ValidationSnapshot): DcfResult {
  const issues = [...snapshot.issues];
  const { fields } = snapshot;
  const forecastDiscountRate = fields.forecastDiscountRate;
  const forecastResults: DcfForecastYearResult[] = [];
  let previousEps = fields.actualEps;

  for (let index = 0; index < FORECAST_YEARS.length; index += 1) {
    const year = FORECAST_YEARS[index];
    const forecastYear = buildForecastYear(
      year,
      previousEps,
      fields.growthRates[index],
      fields.dividendPayouts[index],
      fields.buybackPayouts[index],
      forecastDiscountRate,
      issues,
    );
    forecastResults.push(forecastYear);
    previousEps = forecastYear.eps;
  }

  const forecast = forecastResults as unknown as FiveYear<DcfForecastYearResult>;
  const fiveYearPresentValue = deriveNumber(
    forecast.map((year) => year.presentValue),
    (values) => values.reduce((sum, value) => sum + value, 0),
  );
  const epsY6 = deriveNumber(
    [forecast[4].eps, fields.perpetualGrowth],
    ([epsY5, growth]) => epsY5 * (1 + growth),
  );

  const longRunPayoutDependencies: NodeResult<number>[] = [
    fields.perpetualGrowth,
    fields.normalizedRoe,
  ];
  const longRunPayoutCheck = snapshot.checks.longRunPayout;
  const longRunPayoutIssueIds = inheritedIssueIds([
    ...longRunPayoutDependencies,
    longRunPayoutCheck,
  ]);
  const longRunPayout =
    longRunPayoutIssueIds.length > 0 ||
    fields.perpetualGrowth.status !== "available" ||
    fields.normalizedRoe.status !== "available"
      ? unavailable<number>(longRunPayoutIssueIds)
      : available(
          1 - fields.perpetualGrowth.value / fields.normalizedRoe.value,
          inheritedWarningIds([
            ...longRunPayoutDependencies,
            longRunPayoutCheck,
          ]),
        );

  const cashPayoutY6 = deriveNumber(
    [epsY6, longRunPayout],
    ([eps, payout]) => eps * payout,
  );
  const terminalCheck = snapshot.checks.terminalValue;
  const terminalDependencies = [
    cashPayoutY6,
    fields.longRunDiscountRate,
    fields.perpetualGrowth,
    terminalCheck,
  ] as const;
  const terminalIssueIds = inheritedIssueIds(terminalDependencies);
  const terminalValueAtY5 =
    terminalIssueIds.length > 0 ||
    cashPayoutY6.status !== "available" ||
    fields.longRunDiscountRate.status !== "available" ||
    fields.perpetualGrowth.status !== "available"
      ? unavailable<number>(terminalIssueIds)
      : available(
          cashPayoutY6.value /
            (fields.longRunDiscountRate.value - fields.perpetualGrowth.value),
          inheritedWarningIds(terminalDependencies),
        );
  const terminalPresentValue = deriveNumber(
    [terminalValueAtY5, forecastDiscountRate],
    ([terminalValue, discountRate]) =>
      terminalValue / (1 + discountRate) ** 5,
  );
  const fairIndex = deriveNumber(
    [fiveYearPresentValue, terminalPresentValue],
    ([forecastValue, terminalValue]) => forecastValue + terminalValue,
  );

  let fairIndexError: ValidationIssue | undefined;
  if (fairIndex.status === "available" && fairIndex.value <= 0) {
    fairIndexError = addFairIndexError(issues);
  }

  let shareOfFairIndexPercent: NodeResult<number>;
  if (fairIndexError) {
    shareOfFairIndexPercent = unavailable([fairIndexError.id]);
  } else {
    shareOfFairIndexPercent = deriveNumber(
      [terminalPresentValue, fairIndex],
      ([terminalValue, totalFairValue]) =>
        (terminalValue / totalFairValue) * 100,
    );
  }

  if (
    shareOfFairIndexPercent.status === "available" &&
    shareOfFairIndexPercent.value > TERMINAL_SHARE_WARNING_PERCENT
  ) {
    const warningId = addNodeWarning(issues, {
      id: "node:terminal-share:terminal-share-high",
      code: "TERMINAL_SHARE_HIGH",
      severity: "warning",
      nodeId: "terminal.shareOfFairIndex",
      message:
        "Present value of Terminal Value is more than 80% of Fair Index, so the result is highly dependent on long-run assumptions.",
    });
    shareOfFairIndexPercent = withWarning(
      shareOfFairIndexPercent,
      warningId,
    );
  }

  const comparisonDependencies = [fairIndex, fields.currentIndex] as const;
  const comparisonIssueIds = inheritedIssueIds(comparisonDependencies);
  const comparison =
    comparisonIssueIds.length > 0 ||
    fairIndex.status !== "available" ||
    fields.currentIndex.status !== "available"
      ? unavailable<{
          currentIndex: number;
          fairIndex: number;
          valuationGap: number;
          upsideDownsidePercent: number;
          premiumDiscountToFairPercent: number;
          status: ValuationStatus;
        }>(comparisonIssueIds)
      : fairIndex.value <= 0
        ? unavailable<never>([
            (fairIndexError ?? addFairIndexError(issues)).id,
          ])
        : available(
            {
              currentIndex: fields.currentIndex.value,
              fairIndex: fairIndex.value,
              valuationGap: fairIndex.value - fields.currentIndex.value,
              upsideDownsidePercent:
                (fairIndex.value / fields.currentIndex.value - 1) * 100,
              premiumDiscountToFairPercent:
                (fields.currentIndex.value / fairIndex.value - 1) * 100,
              status: valuationStatus(
                (fairIndex.value / fields.currentIndex.value - 1) * 100,
              ),
            },
            inheritedWarningIds(comparisonDependencies),
          );

  return {
    forecastDiscountRate,
    forecast,
    fiveYearPresentValue,
    terminal: {
      longRunDiscountRate: fields.longRunDiscountRate,
      epsY6,
      longRunPayout,
      cashPayoutY6,
      terminalValueAtY5,
      presentValue: terminalPresentValue,
      shareOfFairIndexPercent,
    },
    fairIndex,
    comparison,
    issues,
  };
}

export function issueForNode(
  result: DcfResult,
  nodeId: DcfNodeId,
): readonly ValidationIssue[] {
  return result.issues.filter((issue) => issue.nodeId === nodeId);
}

