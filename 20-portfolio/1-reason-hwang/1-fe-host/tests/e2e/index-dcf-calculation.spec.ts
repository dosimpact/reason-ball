import { expect, test } from '@playwright/test';

import {
  DEMO_EXPECTED,
  DEMO_INPUT,
} from '../../src/constants/index-dcf';
import { calculateIndexDcf } from '../../src/utils/index-dcf/calculate-index-dcf';
import {
  formatIndexPoints,
  formatPercent,
  formatRatioAsPercent,
  formatSignedPercent,
} from '../../src/utils/index-dcf/format-index-dcf';
import type {
  DcfInputState,
  DcfIssueCode,
  DcfResult,
  FiveYear,
  NodeResult,
  ValidationIssue,
} from '../../src/utils/index-dcf/types';
import {
  setForecastDiscountRateLink,
  synchronizeLinkedLongRunDiscountRate,
  validateIndexDcf,
} from '../../src/utils/index-dcf/validate-index-dcf';

type YearIndex = 0 | 1 | 2 | 3 | 4;

function input(overrides: Partial<DcfInputState> = {}): DcfInputState {
  return {
    ...DEMO_INPUT,
    growthRates: [...DEMO_INPUT.growthRates] as FiveYear<string>,
    dividendPayouts: [...DEMO_INPUT.dividendPayouts] as FiveYear<string>,
    buybackPayouts: [...DEMO_INPUT.buybackPayouts] as FiveYear<string>,
    ...overrides,
  };
}

function replaceYear(
  values: FiveYear<string>,
  index: YearIndex,
  value: string,
): FiveYear<string> {
  const updated = [...values] as [string, string, string, string, string];
  updated[index] = value;
  return updated;
}

function calculate(rawInput: DcfInputState = input()): DcfResult {
  return calculateIndexDcf(validateIndexDcf(rawInput));
}

function valueOf<T>(node: NodeResult<T>): T {
  expect(node.status).toBe('available');
  if (node.status !== 'available') {
    throw new Error(`Expected an available node, received ${node.issueIds.join(', ')}`);
  }
  return node.value;
}

function expectUnavailable(node: NodeResult<unknown>): readonly string[] {
  expect(node.status).toBe('unavailable');
  if (node.status !== 'unavailable') {
    throw new Error('Expected an unavailable node.');
  }
  expect(node.issueIds.length).toBeGreaterThan(0);
  return node.issueIds;
}

function expectWithinTolerance(actual: number, expected: number): void {
  const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-9);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectIssue(
  issues: readonly ValidationIssue[],
  code: DcfIssueCode,
  severity: ValidationIssue['severity'],
): ValidationIssue {
  const issue = issues.find((candidate) => candidate.code === code);
  expect(issue, `Expected ${severity} issue ${code}`).toBeDefined();
  if (!issue) {
    throw new Error(`Missing issue ${code}`);
  }
  expect(issue.severity).toBe(severity);
  return issue;
}

function expectOnlyFiniteNumbers(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(expectOnlyFiniteNumbers);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(expectOnlyFiniteNumbers);
  }
}

test.describe('Index DCF deterministic calculation', () => {
  test('matches every raw Demo fixture value within the specified relative tolerance', () => {
    const result = calculate();
    const comparison = valueOf(result.comparison);

    expectWithinTolerance(
      valueOf(result.forecastDiscountRate),
      DEMO_EXPECTED.forecastDiscountRate,
    );
    result.forecast.forEach((year, index) => {
      expectWithinTolerance(valueOf(year.eps), DEMO_EXPECTED.eps[index]);
    });
    expectWithinTolerance(
      valueOf(result.fiveYearPresentValue),
      DEMO_EXPECTED.fiveYearPresentValue,
    );
    expectWithinTolerance(valueOf(result.terminal.epsY6), DEMO_EXPECTED.epsY6);
    expectWithinTolerance(
      valueOf(result.terminal.longRunPayout),
      DEMO_EXPECTED.longRunPayout,
    );
    expectWithinTolerance(
      valueOf(result.terminal.cashPayoutY6),
      DEMO_EXPECTED.cashPayoutY6,
    );
    expectWithinTolerance(
      valueOf(result.terminal.terminalValueAtY5),
      DEMO_EXPECTED.terminalValueAtY5,
    );
    expectWithinTolerance(
      valueOf(result.terminal.presentValue),
      DEMO_EXPECTED.terminalPresentValue,
    );
    expectWithinTolerance(valueOf(result.fairIndex), DEMO_EXPECTED.fairIndex);
    expectWithinTolerance(
      comparison.upsideDownsidePercent,
      DEMO_EXPECTED.upsideDownsidePercent,
    );
    expectWithinTolerance(
      comparison.premiumDiscountToFairPercent,
      DEMO_EXPECTED.premiumDiscountToFairPercent,
    );
    expectWithinTolerance(
      valueOf(result.terminal.shareOfFairIndexPercent),
      DEMO_EXPECTED.terminalValueSharePercent,
    );
    expect(comparison.status).toBe('undervalued');
    expect(result.issues).toEqual([]);
  });

  test('cascades a Y1 growth change through Y1 to Y6 and Fair Index', () => {
    const result = calculate(
      input({
        growthRates: replaceYear(DEMO_INPUT.growthRates, 0, '7.0'),
      }),
    );

    expectWithinTolerance(valueOf(result.forecast[0].eps), 374.5);
    expectWithinTolerance(valueOf(result.forecast[4].eps), 472.7976215200001);
    expectWithinTolerance(valueOf(result.forecast[0].cashPayout), 262.15);
    expectWithinTolerance(valueOf(result.fiveYearPresentValue), 1153.6613761807048);
    expectWithinTolerance(valueOf(result.terminal.epsY6), 484.6175620580001);
    expectWithinTolerance(valueOf(result.terminal.presentValue), 4476.287384609342);
    expectWithinTolerance(valueOf(result.fairIndex), 5629.948760790046);
  });

  test('adds Dividend and Net Buyback P/O before calculating Cash Payout', () => {
    const result = calculate(
      input({
        dividendPayouts: replaceYear(DEMO_INPUT.dividendPayouts, 2, '50'),
      }),
    );
    const yearThree = result.forecast[2];

    expectWithinTolerance(valueOf(yearThree.totalPayoutRate), 0.8);
    expectWithinTolerance(valueOf(yearThree.cashPayout), 333.4844800000001);
    expectWithinTolerance(valueOf(yearThree.presentValue), 261.08770009296063);
    expectWithinTolerance(valueOf(result.fiveYearPresentValue), 1175.5154566719443);
    expectWithinTolerance(
      valueOf(result.terminal.presentValue),
      DEMO_EXPECTED.terminalPresentValue,
    );
    expectWithinTolerance(valueOf(result.fairIndex), 5609.9683797428825);
  });

  test('formats display values without rounding or mutating the raw calculation graph', () => {
    const result = calculate();
    const beforeFormatting = structuredClone(result);
    const rawFairIndex = valueOf(result.fairIndex);
    const comparison = valueOf(result.comparison);

    expect(formatIndexPoints(rawFairIndex)).toBe('5,577.33');
    expect(formatRatioAsPercent(valueOf(result.forecastDiscountRate))).toBe('8.50%');
    expect(formatSignedPercent(comparison.upsideDownsidePercent)).toBe('+11.55%');
    expect(formatPercent(Math.abs(comparison.premiumDiscountToFairPercent))).toBe(
      '10.35%',
    );

    expect(result).toEqual(beforeFormatting);
    expectWithinTolerance(rawFairIndex, DEMO_EXPECTED.fairIndex);
    expect(rawFairIndex).not.toBe(5577.33);
  });
});

test.describe('linked and independent long-run discount rates', () => {
  test('synchronizes linked r_long and reprices both Terminal Value and forecast PV', () => {
    const synchronized = synchronizeLinkedLongRunDiscountRate(
      input({ riskFreeRate: '5.00' }),
    );
    const result = calculate(synchronized);

    expect(synchronized.independentLongRunDiscountRate).toBe('9.50');
    expectWithinTolerance(valueOf(result.forecastDiscountRate), 0.095);
    expectWithinTolerance(valueOf(result.terminal.longRunDiscountRate), 0.095);
    expectWithinTolerance(valueOf(result.fiveYearPresentValue), 1112.4219131474579);
    expectWithinTolerance(
      valueOf(result.terminal.terminalValueAtY5),
      5715.338404333334,
    );
    expectWithinTolerance(valueOf(result.terminal.presentValue), 3630.5410708804234);
    expectWithinTolerance(valueOf(result.fairIndex), 4742.962984027881);
    expect(valueOf(result.comparison).status).toBe('overvalued');
  });

  test('keeps independent r_long fixed when forecast r changes, then resynchronizes on relink', () => {
    const independent = setForecastDiscountRateLink(input(), false);
    const repriced = input({
      ...independent,
      riskFreeRate: '5.00',
    });
    const independentResult = calculate(repriced);

    expect(repriced.independentLongRunDiscountRate).toBe('8.50');
    expectWithinTolerance(valueOf(independentResult.forecastDiscountRate), 0.095);
    expectWithinTolerance(
      valueOf(independentResult.terminal.longRunDiscountRate),
      0.085,
    );
    expectWithinTolerance(
      valueOf(independentResult.terminal.terminalValueAtY5),
      DEMO_EXPECTED.terminalValueAtY5,
    );
    expectWithinTolerance(
      valueOf(independentResult.terminal.presentValue),
      4235.631249360494,
    );
    expectWithinTolerance(valueOf(independentResult.fairIndex), 5348.053162507951);

    const relinked = setForecastDiscountRateLink(repriced, true);
    const relinkedResult = calculate(relinked);
    expect(relinked.independentLongRunDiscountRate).toBe('9.50');
    expectWithinTolerance(valueOf(relinkedResult.terminal.longRunDiscountRate), 0.095);
    expectWithinTolerance(valueOf(relinkedResult.fairIndex), 4742.962984027881);
  });

  test('preserves the last synchronized independent value while linked r is invalid', () => {
    const invalidLinked = synchronizeLinkedLongRunDiscountRate(
      input({ riskFreeRate: '' }),
    );
    const snapshot = validateIndexDcf(invalidLinked);

    expect(invalidLinked.independentLongRunDiscountRate).toBe('8.50');
    expectIssue(snapshot.issues, 'REQUIRED_VALUE', 'error');
    expectUnavailable(snapshot.fields.forecastDiscountRate);
    expectUnavailable(snapshot.fields.longRunDiscountRate);
  });
});

test.describe('validation errors and dependency-aware availability', () => {
  test('rejects non-finite input without exposing NaN or Infinity downstream', () => {
    const snapshot = validateIndexDcf(input({ actualEps: 'not-a-number' }));
    const result = calculateIndexDcf(snapshot);

    expectIssue(snapshot.issues, 'INVALID_NUMBER', 'error');
    expectUnavailable(result.forecast[0].eps);
    expectUnavailable(result.fairIndex);
    expectOnlyFiniteNumbers(result);
  });

  test('keeps Fair Index available when only Current Index is invalid', () => {
    const snapshot = validateIndexDcf(input({ currentIndex: '0' }));
    const result = calculateIndexDcf(snapshot);

    const issue = expectIssue(snapshot.issues, 'VALUE_OUT_OF_RANGE', 'error');
    expect(issue.fieldId).toBe('currentIndex');
    expectWithinTolerance(valueOf(result.fairIndex), DEMO_EXPECTED.fairIndex);
    expectUnavailable(result.comparison);
  });

  test('stops the forecast from the first invalid growth year but retains prior years', () => {
    const snapshot = validateIndexDcf(
      input({
        growthRates: replaceYear(DEMO_INPUT.growthRates, 2, '21'),
      }),
    );
    const result = calculateIndexDcf(snapshot);

    const issue = expectIssue(snapshot.issues, 'VALUE_OUT_OF_RANGE', 'error');
    expect(issue.fieldId).toBe('growthRates.2');
    valueOf(result.forecast[0].eps);
    valueOf(result.forecast[1].eps);
    expectUnavailable(result.forecast[2].eps);
    expectUnavailable(result.forecast[3].eps);
    expectUnavailable(result.forecast[4].eps);
    expectUnavailable(result.terminal.epsY6);
    expectUnavailable(result.fairIndex);
  });

  test('keeps five-year PV while g equal to ROE blocks the terminal branch', () => {
    const snapshot = validateIndexDcf(
      input({ perpetualGrowth: '5.00', normalizedRoe: '5.00' }),
    );
    const result = calculateIndexDcf(snapshot);

    expectIssue(snapshot.issues, 'PERPETUAL_GROWTH_NOT_BELOW_ROE', 'error');
    valueOf(result.fiveYearPresentValue);
    expectUnavailable(result.terminal.longRunPayout);
    expectUnavailable(result.terminal.terminalValueAtY5);
    expectUnavailable(result.fairIndex);
  });

  test('keeps five-year PV while r_long equal to g blocks Terminal Value', () => {
    const snapshot = validateIndexDcf(
      input({
        useForecastDiscountRate: false,
        independentLongRunDiscountRate: '2.50',
      }),
    );
    const result = calculateIndexDcf(snapshot);

    expectIssue(snapshot.issues, 'LONG_RUN_DISCOUNT_NOT_ABOVE_GROWTH', 'error');
    valueOf(result.fiveYearPresentValue);
    valueOf(result.terminal.cashPayoutY6);
    expectUnavailable(result.terminal.terminalValueAtY5);
    expectUnavailable(result.fairIndex);
  });

  test('blocks market comparison when an otherwise valid fixture produces non-positive Fair Index', () => {
    const result = calculate(
      input({
        actualEps: '1',
        currentIndex: '1',
        growthRates: ['-20', '-20', '-20', '-20', '-20'],
        dividendPayouts: ['0', '0', '0', '0', '0'],
        buybackPayouts: ['-50', '-50', '-50', '-50', '-50'],
        riskFreeRate: '10',
        impliedErp: '10',
        perpetualGrowth: '0',
        normalizedRoe: '5',
        useForecastDiscountRate: false,
        independentLongRunDiscountRate: '20',
      }),
    );

    expectWithinTolerance(valueOf(result.fairIndex), -0.20987654320987625);
    expectIssue(result.issues, 'NON_POSITIVE_FAIR_INDEX', 'error');
    expectUnavailable(result.terminal.shareOfFairIndexPercent);
    expectUnavailable(result.comparison);
    expectOnlyFiniteNumbers(result);
  });
});

test.describe('economic warnings', () => {
  test('continues calculating when Total P/O is above 100%', () => {
    const result = calculate(
      input({
        dividendPayouts: replaceYear(DEMO_INPUT.dividendPayouts, 0, '80'),
      }),
    );
    const issue = expectIssue(
      result.issues,
      'TOTAL_PAYOUT_OUTSIDE_NORMAL_RANGE',
      'warning',
    );

    expect(issue.nodeId).toBe('forecast.1.totalPayout');
    expectWithinTolerance(valueOf(result.forecast[0].totalPayoutRate), 1.1);
    expectWithinTolerance(valueOf(result.forecast[0].cashPayout), 408.1);
    expectWithinTolerance(valueOf(result.fairIndex), 5714.106610779649);
    expect(result.forecast[0].totalPayoutRate).toMatchObject({
      status: 'available',
      warningIds: [issue.id],
    });
  });

  test('continues calculating and propagates the narrow terminal spread warning', () => {
    const result = calculate(
      input({
        useForecastDiscountRate: false,
        independentLongRunDiscountRate: '3.00',
      }),
    );
    const issue = expectIssue(result.issues, 'TERMINAL_SPREAD_SENSITIVE', 'warning');

    valueOf(result.terminal.terminalValueAtY5);
    valueOf(result.fairIndex);
    expect(result.terminal.terminalValueAtY5).toMatchObject({
      status: 'available',
      warningIds: expect.arrayContaining([issue.id]),
    });
    expect(result.fairIndex).toMatchObject({
      status: 'available',
      warningIds: expect.arrayContaining([issue.id]),
    });
  });

  test('warns but preserves the result when Terminal Value exceeds 80% of Fair Index', () => {
    const result = calculate(
      input({
        dividendPayouts: ['0', '0', '0', '0', '0'],
        buybackPayouts: ['0', '0', '0', '0', '0'],
      }),
    );
    const issue = expectIssue(result.issues, 'TERMINAL_SHARE_HIGH', 'warning');

    expectWithinTolerance(valueOf(result.fiveYearPresentValue), 0);
    expectWithinTolerance(valueOf(result.terminal.shareOfFairIndexPercent), 100);
    valueOf(result.fairIndex);
    valueOf(result.comparison);
    expect(result.terminal.shareOfFairIndexPercent).toMatchObject({
      status: 'available',
      warningIds: [issue.id],
    });
  });
});
