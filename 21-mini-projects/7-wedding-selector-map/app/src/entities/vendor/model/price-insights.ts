export interface PriceSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
}
export interface PriceBin {
  lower: number;
  upper: number;
  count: number;
}
function cleanPrices(values: readonly number[]) {
  return values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
}
function quantile(sorted: readonly number[], fraction: number) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return (
    sorted[lower] +
    (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower)
  );
}
export function summarizePrices(
  values: readonly number[],
): PriceSummary | null {
  const sorted = cleanPrices(values);
  if (!sorted.length) return null;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
  };
}
/** Equal-width empirical bins; the final bin includes its upper edge. No normal-fit assumptions. */
export function buildPriceHistogram(
  values: readonly number[],
  binCount = 8,
): PriceBin[] {
  const sorted = cleanPrices(values);
  if (!sorted.length) return [];
  const count = Number.isFinite(binCount)
    ? Math.max(1, Math.min(24, Math.floor(binCount)))
    : 8;
  const minimum = sorted[0];
  const maximum = sorted[sorted.length - 1];
  const span = maximum - minimum || Math.max(maximum * 0.1, 1);
  const lower = maximum === minimum ? Math.max(0, minimum - span / 2) : minimum;
  const width = span / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    lower: lower + index * width,
    upper: lower + (index + 1) * width,
    count: 0,
  }));
  for (const price of sorted)
    bins[Math.min(count - 1, Math.max(0, Math.floor((price - lower) / width)))]
      .count++;
  return bins;
}
