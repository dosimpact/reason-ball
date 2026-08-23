const INDEX_POINT_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SIGNED_INDEX_POINT_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SIGNED_PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export const CALCULATION_UNAVAILABLE = "Calculation unavailable";

export function formatIndexPoints(value: number): string {
  return INDEX_POINT_FORMATTER.format(value);
}

export function formatSignedIndexPoints(value: number): string {
  return SIGNED_INDEX_POINT_FORMATTER.format(value);
}

/** Formats a value already expressed in percentage points. */
export function formatPercent(value: number): string {
  return `${PERCENT_FORMATTER.format(value)}%`;
}

/** Formats a signed value already expressed in percentage points. */
export function formatSignedPercent(value: number): string {
  return `${SIGNED_PERCENT_FORMATTER.format(value)}%`;
}

/** Converts a decimal ratio such as 0.085 to 8.50%. */
export function formatRatioAsPercent(value: number): string {
  return formatPercent(value * 100);
}

/** Converts a signed decimal ratio such as -0.1 to -10.00%. */
export function formatSignedRatioAsPercent(value: number): string {
  return formatSignedPercent(value * 100);
}

