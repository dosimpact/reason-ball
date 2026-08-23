import type {
  DcfInputState,
  FiveYear,
  ForecastYear,
  InputConstraints,
} from "../utils/index-dcf/types";

export const FORECAST_YEARS: FiveYear<ForecastYear> = [1, 2, 3, 4, 5];

export const INPUT_CONSTRAINTS: InputConstraints = {
  actualEps: {
    label: "Actual Index EPS",
    min: 1,
    max: 10_000,
    step: 1,
    unit: "indexPoints",
  },
  currentIndex: {
    label: "Current Index",
    min: 1,
    max: 100_000,
    step: 1,
    unit: "indexPoints",
  },
  growthRates: {
    label: "EPS Growth",
    min: -20,
    max: 20,
    step: 0.1,
    unit: "percent",
  },
  dividendPayouts: {
    label: "Dividend P/O",
    min: 0,
    max: 100,
    step: 1,
    unit: "percent",
  },
  buybackPayouts: {
    label: "Net Buyback P/O",
    min: -50,
    max: 100,
    step: 1,
    unit: "percent",
  },
  riskFreeRate: {
    label: "Risk-free Rate",
    min: 0,
    max: 10,
    step: 0.05,
    unit: "percent",
  },
  impliedErp: {
    label: "Implied ERP",
    min: 0,
    max: 10,
    step: 0.05,
    unit: "percent",
  },
  perpetualGrowth: {
    label: "Perpetual Growth",
    min: 0,
    max: 5,
    step: 0.05,
    unit: "percent",
  },
  normalizedRoe: {
    label: "Long-run Normalized ROE",
    min: 5,
    max: 40,
    step: 0.25,
    unit: "percent",
  },
  independentLongRunDiscountRate: {
    label: "Independent Long-run Discount Rate",
    min: 1,
    max: 20,
    step: 0.05,
    unit: "percent",
  },
};

const FIVE_SIX_PERCENT: FiveYear<string> = ["6.0", "6.0", "6.0", "6.0", "6.0"];
const FIVE_FORTY_PERCENT: FiveYear<string> = ["40", "40", "40", "40", "40"];
const FIVE_THIRTY_PERCENT: FiveYear<string> = ["30", "30", "30", "30", "30"];

export const DEMO_INPUT: DcfInputState = {
  indexName: "Demo Broad Market Index",
  valuationDate: "2026-01-01",
  actualEps: "350",
  currentIndex: "5000",
  growthRates: FIVE_SIX_PERCENT,
  dividendPayouts: FIVE_FORTY_PERCENT,
  buybackPayouts: FIVE_THIRTY_PERCENT,
  riskFreeRate: "4.00",
  impliedErp: "4.50",
  perpetualGrowth: "2.50",
  normalizedRoe: "15.00",
  useForecastDiscountRate: true,
  independentLongRunDiscountRate: "8.50",
};

/** Exact raw calculation values used by the deterministic Demo tests. */
export const DEMO_EXPECTED = {
  forecastDiscountRate: 0.085,
  eps: [
    371,
    393.26000000000005,
    416.8556000000001,
    441.8669360000001,
    468.37895216000015,
  ] as FiveYear<number>,
  fiveYearPresentValue: 1142.8794941603244,
  epsY6: 480.0884259640001,
  longRunPayout: 0.8333333333333333,
  cashPayoutY6: 400.0736883033334,
  terminalValueAtY5: 6667.894805055558,
  terminalPresentValue: 4434.452923070939,
  fairIndex: 5577.332417231263,
  upsideDownsidePercent: 11.546648344625265,
  premiumDiscountToFairPercent: Number("-10.351407698913284"),
  terminalValueSharePercent: 79.50849243574977,
} as const;

export const VALUATION_STATUS_EPSILON_PERCENT = 0.005;
export const TERMINAL_SPREAD_WARNING_DECIMAL = 0.01;
export const TERMINAL_SHARE_WARNING_PERCENT = 80;
