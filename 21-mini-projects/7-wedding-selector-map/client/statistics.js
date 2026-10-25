(function (global) {
  'use strict';
  const numeric = values => values.filter(v => typeof v === 'number' && Number.isFinite(v));
  function summarize(input) {
    const values = numeric(input).sort((a, b) => a - b);
    if (!values.length) return { count: 0, values, mean: null, median: null, sd: null, min: null, max: null };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const middle = Math.floor(values.length / 2);
    return { count: values.length, values, mean, median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2, sd: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length), min: values[0], max: values.at(-1) };
  }
  function compare(value, input, selfPresent = true) {
    const stats = summarize(input);
    if (!Number.isFinite(value) || !stats.count) return null;
    const n = stats.count - (selfPresent && stats.values.includes(value) ? 1 : 0);
    return { ...stats, savingsPct: stats.mean > 0 ? (stats.mean - value) / stats.mean * 100 : 0, cheaperThanPct: n > 0 ? stats.values.filter(other => other > value).length / n * 100 : null, rank: stats.values.filter(other => other < value).length + 1, comparisonCount: n };
  }
  function histogram(input, count = 16) {
    const stats = summarize(input);
    if (!stats.count) return { ...stats, bins: [], lower: 0, upper: 1, width: 1 };
    const spread = Math.max(stats.max - stats.min, stats.max * .12, 1000);
    const lower = Math.max(0, stats.min - spread * .08);
    const upper = stats.max + spread * .08;
    const width = (upper - lower) / count;
    const bins = Array.from({ length: count }, (_, i) => ({ lower: lower + i * width, upper: lower + (i + 1) * width, count: 0 }));
    for (const value of stats.values) bins[Math.max(0, Math.min(count - 1, Math.floor((value - lower) / width)))].count++;
    return { ...stats, bins, lower, upper, width };
  }
  function normalDensity(value, mean, sd) {
    return sd > 0 ? Math.exp(-.5 * ((value - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)) : 0;
  }
  function sortVenues(venues, field, direction = 'asc') {
    return [...venues].sort((a, b) => {
      const av = field in a.metrics ? a.metrics[field] : a[field];
      const bv = field in b.metrics ? b.metrics[field] : b[field];
      if (av == null || av === '') return bv == null || bv === '' ? a.name.localeCompare(b.name, 'ko') : 1;
      if (bv == null || bv === '') return -1;
      const difference = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko');
      return difference * (direction === 'desc' ? -1 : 1) || a.name.localeCompare(b.name, 'ko');
    });
  }
  global.WeddingStats = { summarize, compare, histogram, normalDensity, sortVenues };
})(globalThis);
