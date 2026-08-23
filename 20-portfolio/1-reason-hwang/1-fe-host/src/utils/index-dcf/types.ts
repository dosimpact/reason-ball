export type FiveYear<T> = readonly [T, T, T, T, T];

export type ForecastYear = 1 | 2 | 3 | 4 | 5;

export type AnnualInputKind =
  | "growthRates"
  | "dividendPayouts"
  | "buybackPayouts";

export type ScalarNumericInputKey =
  | "actualEps"
  | "currentIndex"
  | "riskFreeRate"
  | "impliedErp"
  | "perpetualGrowth"
  | "normalizedRoe"
  | "independentLongRunDiscountRate";

export type NumericInputKey = ScalarNumericInputKey | AnnualInputKind;

export type DcfFieldId =
  | "indexName"
  | "valuationDate"
  | ScalarNumericInputKey
  | `${AnnualInputKind}.${0 | 1 | 2 | 3 | 4}`;

export interface DcfInputState {
  readonly indexName: string;
  readonly valuationDate: string;
  readonly actualEps: string;
  readonly currentIndex: string;
  readonly growthRates: FiveYear<string>;
  readonly dividendPayouts: FiveYear<string>;
  readonly buybackPayouts: FiveYear<string>;
  readonly riskFreeRate: string;
  readonly impliedErp: string;
  readonly perpetualGrowth: string;
  readonly normalizedRoe: string;
  readonly useForecastDiscountRate: boolean;
  readonly independentLongRunDiscountRate: string;
}

export type DcfIssueCode =
  | "REQUIRED_VALUE"
  | "INVALID_NUMBER"
  | "VALUE_OUT_OF_RANGE"
  | "INDEX_NAME_TOO_LONG"
  | "INVALID_VALUATION_DATE"
  | "PERPETUAL_GROWTH_NOT_BELOW_ROE"
  | "LONG_RUN_DISCOUNT_NOT_ABOVE_GROWTH"
  | "TOTAL_PAYOUT_OUTSIDE_NORMAL_RANGE"
  | "TERMINAL_SPREAD_SENSITIVE"
  | "TERMINAL_SHARE_HIGH"
  | "NON_POSITIVE_FAIR_INDEX";

export type DcfIssueSeverity = "error" | "warning";

export type DcfNodeId =
  | "forecastDiscountRate"
  | `forecast.${ForecastYear}.eps`
  | `forecast.${ForecastYear}.totalPayout`
  | `forecast.${ForecastYear}.cashPayout`
  | `forecast.${ForecastYear}.presentValue`
  | "fiveYearPresentValue"
  | "terminal.longRunDiscountRate"
  | "terminal.epsY6"
  | "terminal.longRunPayout"
  | "terminal.cashPayoutY6"
  | "terminal.terminalValueAtY5"
  | "terminal.presentValue"
  | "terminal.shareOfFairIndex"
  | "fairIndex"
  | "comparison";

export interface ValidationIssue {
  readonly id: string;
  readonly code: DcfIssueCode;
  readonly severity: DcfIssueSeverity;
  readonly message: string;
  readonly fieldId?: DcfFieldId;
  readonly nodeId?: DcfNodeId;
}

export type NodeResult<T> =
  | {
      readonly status: "available";
      readonly value: T;
      readonly warningIds: readonly string[];
    }
  | {
      readonly status: "unavailable";
      readonly issueIds: readonly string[];
    };

export interface ValidatedDcfFields {
  readonly indexName: NodeResult<string>;
  readonly valuationDate: NodeResult<string>;
  readonly actualEps: NodeResult<number>;
  readonly currentIndex: NodeResult<number>;
  readonly growthRates: FiveYear<NodeResult<number>>;
  readonly dividendPayouts: FiveYear<NodeResult<number>>;
  readonly buybackPayouts: FiveYear<NodeResult<number>>;
  readonly riskFreeRate: NodeResult<number>;
  readonly impliedErp: NodeResult<number>;
  readonly perpetualGrowth: NodeResult<number>;
  readonly normalizedRoe: NodeResult<number>;
  readonly useForecastDiscountRate: NodeResult<boolean>;
  readonly independentLongRunDiscountRate: NodeResult<number>;
  readonly forecastDiscountRate: NodeResult<number>;
  readonly longRunDiscountRate: NodeResult<number>;
}

export interface ValidationChecks {
  readonly longRunPayout: NodeResult<true>;
  readonly terminalValue: NodeResult<true>;
}

export interface ValidationSnapshot {
  readonly fields: ValidatedDcfFields;
  readonly checks: ValidationChecks;
  readonly issues: readonly ValidationIssue[];
}

export interface DcfForecastYearResult {
  readonly year: ForecastYear;
  readonly growthRate: NodeResult<number>;
  readonly eps: NodeResult<number>;
  readonly dividendPayoutRate: NodeResult<number>;
  readonly buybackPayoutRate: NodeResult<number>;
  readonly totalPayoutRate: NodeResult<number>;
  readonly cashPayout: NodeResult<number>;
  readonly presentValue: NodeResult<number>;
}

export type ValuationStatus = "undervalued" | "fair" | "overvalued";

export interface DcfComparisonValue {
  readonly currentIndex: number;
  readonly fairIndex: number;
  readonly valuationGap: number;
  /** Percentage points, e.g. 11.5 means +11.5%. */
  readonly upsideDownsidePercent: number;
  /** Percentage points, e.g. -10.3 means a 10.3% discount to fair. */
  readonly premiumDiscountToFairPercent: number;
  readonly status: ValuationStatus;
}

export interface DcfTerminalResult {
  /** Decimal rate, e.g. 0.085 means 8.5%. */
  readonly longRunDiscountRate: NodeResult<number>;
  readonly epsY6: NodeResult<number>;
  /** Decimal payout ratio, e.g. 0.8333 means 83.33%. */
  readonly longRunPayout: NodeResult<number>;
  readonly cashPayoutY6: NodeResult<number>;
  readonly terminalValueAtY5: NodeResult<number>;
  readonly presentValue: NodeResult<number>;
  /** Percentage points, e.g. 79.5 means 79.5%. */
  readonly shareOfFairIndexPercent: NodeResult<number>;
}

export interface DcfResult {
  /** Decimal rate, e.g. 0.085 means 8.5%. */
  readonly forecastDiscountRate: NodeResult<number>;
  readonly forecast: FiveYear<DcfForecastYearResult>;
  readonly fiveYearPresentValue: NodeResult<number>;
  readonly terminal: DcfTerminalResult;
  readonly fairIndex: NodeResult<number>;
  readonly comparison: NodeResult<DcfComparisonValue>;
  readonly issues: readonly ValidationIssue[];
}

export interface NumericInputConstraint {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: "indexPoints" | "percent";
}

export type InputConstraints = Readonly<
  Record<NumericInputKey, NumericInputConstraint>
>;

export function annualFieldId(
  kind: AnnualInputKind,
  yearIndex: 0 | 1 | 2 | 3 | 4,
): DcfFieldId {
  return `${kind}.${yearIndex}`;
}
