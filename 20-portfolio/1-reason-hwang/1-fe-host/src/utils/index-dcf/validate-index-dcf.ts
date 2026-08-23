import {
  INPUT_CONSTRAINTS,
  TERMINAL_SPREAD_WARNING_DECIMAL,
} from "../../constants/index-dcf";
import { available, inheritedIssueIds, unavailable } from "./node-result";
import type {
  AnnualInputKind,
  DcfFieldId,
  DcfInputState,
  FiveYear,
  NodeResult,
  NumericInputConstraint,
  ScalarNumericInputKey,
  ValidationIssue,
  ValidationSnapshot,
} from "./types";
import { annualFieldId } from "./types";

type IssueCollector = ValidationIssue[];

const YEAR_INDEXES = [0, 1, 2, 3, 4] as const;

function mapFiveYear<T, U>(
  values: FiveYear<T>,
  map: (value: T, index: 0 | 1 | 2 | 3 | 4) => U,
): FiveYear<U> {
  return [
    map(values[0], 0),
    map(values[1], 1),
    map(values[2], 2),
    map(values[3], 3),
    map(values[4], 4),
  ];
}

function fieldIssue(
  issues: IssueCollector,
  fieldId: DcfFieldId,
  code: ValidationIssue["code"],
  message: string,
): NodeResult<never> {
  const issue: ValidationIssue = {
    id: `field:${fieldId}:${code.toLowerCase()}`,
    code,
    severity: "error",
    fieldId,
    message,
  };

  issues.push(issue);
  return unavailable([issue.id]);
}

function parseNumericField(
  rawValue: string,
  fieldId: DcfFieldId,
  constraint: NumericInputConstraint,
  issues: IssueCollector,
  label = constraint.label,
): NodeResult<number> {
  if (rawValue.trim() === "") {
    return fieldIssue(
      issues,
      fieldId,
      "REQUIRED_VALUE",
      `${label} is required.`,
    );
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return fieldIssue(
      issues,
      fieldId,
      "INVALID_NUMBER",
      `${label} must be a finite number.`,
    );
  }

  if (parsed < constraint.min || parsed > constraint.max) {
    return fieldIssue(
      issues,
      fieldId,
      "VALUE_OUT_OF_RANGE",
      `${label} must be between ${constraint.min} and ${constraint.max}.`,
    );
  }

  return available(constraint.unit === "percent" ? parsed / 100 : parsed);
}

function validateAnnualFields(
  values: FiveYear<string>,
  kind: AnnualInputKind,
  issues: IssueCollector,
): FiveYear<NodeResult<number>> {
  const constraint = INPUT_CONSTRAINTS[kind];

  return mapFiveYear(values, (value, index) =>
    parseNumericField(
      value,
      annualFieldId(kind, index),
      constraint,
      issues,
      `${constraint.label} Y${index + 1}`,
    ),
  );
}

function validateIndexName(
  value: string,
  issues: IssueCollector,
): NodeResult<string> {
  if (value.length <= 80) {
    return available(value);
  }

  return fieldIssue(
    issues,
    "indexName",
    "INDEX_NAME_TOO_LONG",
    "Index Name must be 80 characters or fewer.",
  );
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateValuationDate(
  value: string,
  issues: IssueCollector,
): NodeResult<string> {
  if (isIsoCalendarDate(value)) {
    return available(value);
  }

  return fieldIssue(
    issues,
    "valuationDate",
    "INVALID_VALUATION_DATE",
    "Valuation As-of Date must be a valid ISO date.",
  );
}

function deriveSum(
  left: NodeResult<number>,
  right: NodeResult<number>,
): NodeResult<number> {
  const issueIds = inheritedIssueIds([left, right]);

  if (issueIds.length > 0 || left.status !== "available" || right.status !== "available") {
    return unavailable(issueIds);
  }

  return available(left.value + right.value);
}

function validateLongRunPayoutCheck(
  perpetualGrowth: NodeResult<number>,
  normalizedRoe: NodeResult<number>,
  issues: IssueCollector,
): NodeResult<true> {
  const issueIds = inheritedIssueIds([perpetualGrowth, normalizedRoe]);

  if (
    issueIds.length > 0 ||
    perpetualGrowth.status !== "available" ||
    normalizedRoe.status !== "available"
  ) {
    return unavailable(issueIds);
  }

  if (perpetualGrowth.value >= normalizedRoe.value) {
    const issue: ValidationIssue = {
      id: "node:long-run-payout:perpetual-growth-not-below-roe",
      code: "PERPETUAL_GROWTH_NOT_BELOW_ROE",
      severity: "error",
      nodeId: "terminal.longRunPayout",
      message: "Perpetual Growth must be lower than normalized ROE.",
    };
    issues.push(issue);
    return unavailable([issue.id]);
  }

  return available(true);
}

function validateTerminalValueCheck(
  longRunDiscountRate: NodeResult<number>,
  perpetualGrowth: NodeResult<number>,
  issues: IssueCollector,
): NodeResult<true> {
  const issueIds = inheritedIssueIds([longRunDiscountRate, perpetualGrowth]);

  if (
    issueIds.length > 0 ||
    longRunDiscountRate.status !== "available" ||
    perpetualGrowth.status !== "available"
  ) {
    return unavailable(issueIds);
  }

  const spread = longRunDiscountRate.value - perpetualGrowth.value;

  if (spread <= 0) {
    const issue: ValidationIssue = {
      id: "node:terminal-value:long-run-discount-not-above-growth",
      code: "LONG_RUN_DISCOUNT_NOT_ABOVE_GROWTH",
      severity: "error",
      nodeId: "terminal.terminalValueAtY5",
      message: "Long-run discount rate must be greater than Perpetual Growth.",
    };
    issues.push(issue);
    return unavailable([issue.id]);
  }

  if (spread < TERMINAL_SPREAD_WARNING_DECIMAL) {
    const issue: ValidationIssue = {
      id: "node:terminal-value:terminal-spread-sensitive",
      code: "TERMINAL_SPREAD_SENSITIVE",
      severity: "warning",
      nodeId: "terminal.terminalValueAtY5",
      message:
        "Long-run discount rate is less than 1 percentage point above Perpetual Growth, so Terminal Value is highly sensitive.",
    };
    issues.push(issue);
    return available(true, [issue.id]);
  }

  return available(true);
}

function parseScalar(
  input: DcfInputState,
  key: ScalarNumericInputKey,
  issues: IssueCollector,
): NodeResult<number> {
  return parseNumericField(
    input[key],
    key,
    INPUT_CONSTRAINTS[key],
    issues,
  );
}

export function validateIndexDcf(input: DcfInputState): ValidationSnapshot {
  const issues: IssueCollector = [];
  const indexName = validateIndexName(input.indexName, issues);
  const valuationDate = validateValuationDate(input.valuationDate, issues);
  const actualEps = parseScalar(input, "actualEps", issues);
  const currentIndex = parseScalar(input, "currentIndex", issues);
  const growthRates = validateAnnualFields(input.growthRates, "growthRates", issues);
  const dividendPayouts = validateAnnualFields(
    input.dividendPayouts,
    "dividendPayouts",
    issues,
  );
  const buybackPayouts = validateAnnualFields(
    input.buybackPayouts,
    "buybackPayouts",
    issues,
  );
  const riskFreeRate = parseScalar(input, "riskFreeRate", issues);
  const impliedErp = parseScalar(input, "impliedErp", issues);
  const perpetualGrowth = parseScalar(input, "perpetualGrowth", issues);
  const normalizedRoe = parseScalar(input, "normalizedRoe", issues);
  const forecastDiscountRate = deriveSum(riskFreeRate, impliedErp);
  // The independent value is inactive while linked. Model it as the effective
  // linked value so no orphan error can leak from dormant raw input.
  const independentLongRunDiscountRate = input.useForecastDiscountRate
    ? forecastDiscountRate
    : parseScalar(input, "independentLongRunDiscountRate", issues);
  const longRunDiscountRate = input.useForecastDiscountRate
    ? forecastDiscountRate
    : independentLongRunDiscountRate;
  const longRunPayout = validateLongRunPayoutCheck(
    perpetualGrowth,
    normalizedRoe,
    issues,
  );
  const terminalValue = validateTerminalValueCheck(
    longRunDiscountRate,
    perpetualGrowth,
    issues,
  );

  return {
    fields: {
      indexName,
      valuationDate,
      actualEps,
      currentIndex,
      growthRates,
      dividendPayouts,
      buybackPayouts,
      riskFreeRate,
      impliedErp,
      perpetualGrowth,
      normalizedRoe,
      useForecastDiscountRate: available(input.useForecastDiscountRate),
      independentLongRunDiscountRate,
      forecastDiscountRate,
      longRunDiscountRate,
    },
    checks: { longRunPayout, terminalValue },
    issues,
  };
}

function parseLinkedRatePart(
  value: string,
  constraint: NumericInputConstraint,
): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < constraint.min ||
    parsed > constraint.max
  ) {
    return undefined;
  }

  return parsed;
}

/**
 * Copies the last valid linked r into the dormant independent raw field.
 * Invalid linked inputs deliberately preserve the previous independent value.
 */
export function synchronizeLinkedLongRunDiscountRate(
  input: DcfInputState,
): DcfInputState {
  if (!input.useForecastDiscountRate) {
    return input;
  }

  const riskFree = parseLinkedRatePart(
    input.riskFreeRate,
    INPUT_CONSTRAINTS.riskFreeRate,
  );
  const erp = parseLinkedRatePart(input.impliedErp, INPUT_CONSTRAINTS.impliedErp);

  if (riskFree === undefined || erp === undefined) {
    return input;
  }

  return {
    ...input,
    independentLongRunDiscountRate: (riskFree + erp).toFixed(2),
  };
}

/** Applies the link transition without losing the last valid synchronized rate. */
export function setForecastDiscountRateLink(
  input: DcfInputState,
  useForecastDiscountRate: boolean,
): DcfInputState {
  if (useForecastDiscountRate) {
    return synchronizeLinkedLongRunDiscountRate({
      ...input,
      useForecastDiscountRate: true,
    });
  }

  const synchronized = synchronizeLinkedLongRunDiscountRate(input);
  return { ...synchronized, useForecastDiscountRate: false };
}

export const FORECAST_YEAR_INDEXES = YEAR_INDEXES;
