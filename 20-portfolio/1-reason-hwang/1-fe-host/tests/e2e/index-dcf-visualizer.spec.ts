import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const route = '/index-dcf-visualizer';

function resultOutput(page: Page, name: string) {
  return page.getByRole('status', { name, exact: true });
}

function numberInput(page: Page, name: string) {
  return page.getByRole('spinbutton', { name, exact: true });
}

function slider(page: Page, name: string) {
  return page.getByRole('slider', { name, exact: true });
}

async function openDemo(page: Page) {
  await page.goto(route);
  await expect(
    page.getByRole('heading', {
      name: 'See every assumption flow into Fair Index',
      exact: true,
    }),
  ).toBeVisible();
}

async function expectDemoComparison(page: Page) {
  await expect(resultOutput(page, 'Fair Index')).toHaveText('5,577.33');
  await expect(resultOutput(page, 'Upside/Downside')).toHaveText('+11.55%');
  await expect(resultOutput(page, 'Premium/Discount to Fair')).toHaveText(
    '10.35% Discount to Fair',
  );
  await expect(resultOutput(page, 'Valuation status')).toHaveText(
    'Undervalued · 저평가',
  );
  await expect(
    page.getByRole('img', {
      name: /Current Index 5,000\.00; Fair Index 5,577\.33/,
    }),
  ).toBeVisible();
}

test.describe('Index DCF visualizer', () => {
  test('renders the deterministic Demo comparison and accessible chart', async ({ page }) => {
    await openDemo(page);

    await expectDemoComparison(page);
    await expect(page.getByRole('region', { name: 'Errors' })).toContainText(
      'Errors (0)',
    );
    await expect(page.getByRole('region', { name: 'Warnings' })).toContainText(
      'Warnings (0)',
    );
  });

  test('keeps slider and number input synchronized while cascading Y1 growth', async ({
    page,
  }) => {
    await openDemo(page);

    const growthNumber = numberInput(page, 'EPS Growth Y1');
    const growthSlider = slider(page, 'EPS Growth Y1');
    await growthNumber.fill('7');

    await expect(growthSlider).toHaveValue('7');
    await expect(
      page.getByRole('region', { name: 'Discount & terminal value' }),
    ).toContainText('4,476.29');
    await expect(resultOutput(page, 'Fair Index')).toHaveText('5,629.95');

    await page.getByRole('button', { name: 'Reset Demo', exact: true }).click();
    await expect(growthNumber).toHaveValue('6.0');
    await growthSlider.focus();
    await growthSlider.press('ArrowRight');

    await expect(growthSlider).toHaveValue('6.1');
    await expect(growthNumber).toHaveValue('6.1');
    await expect(resultOutput(page, 'Fair Index')).toHaveText('5,582.59');
  });

  test('links and unlinks the long-run discount rate deterministically', async ({ page }) => {
    await openDemo(page);

    const linkToggle = page.getByRole('checkbox', {
      name: /^Use Forecast Discount Rate/,
    });
    const riskFreeRate = numberInput(page, 'Risk-free Rate');
    const longRunRate = numberInput(page, 'Long-run Discount Rate');

    await expect(linkToggle).toBeChecked();
    await expect(longRunRate).toBeDisabled();
    await riskFreeRate.fill('5.00');
    await expect(longRunRate).toHaveValue('9.50');
    await expect(resultOutput(page, 'Fair Index')).toHaveText('4,742.96');

    await page.getByRole('button', { name: 'Reset Demo', exact: true }).click();
    await linkToggle.uncheck();
    await expect(longRunRate).toBeEnabled();
    await expect(longRunRate).toHaveValue('8.50');

    await riskFreeRate.fill('5.00');
    await expect(longRunRate).toHaveValue('8.50');
    await expect(
      page.getByRole('region', { name: 'Discount & terminal value' }),
    ).toContainText('4,235.63');
    await expect(resultOutput(page, 'Fair Index')).toHaveText('5,348.05');

    await linkToggle.check();
    await expect(longRunRate).toBeDisabled();
    await expect(longRunRate).toHaveValue('9.50');
    await expect(resultOutput(page, 'Fair Index')).toHaveText('4,742.96');
  });

  test('keeps results available and exposes a warning above 100% Total P/O', async ({
    page,
  }) => {
    await openDemo(page);

    await numberInput(page, 'Dividend P/O Y1').fill('80');

    const warnings = page.getByRole('region', { name: 'Warnings' });
    await expect(warnings).toContainText('Warnings (1)');
    await expect(warnings).toContainText(
      'Y1 Total P/O is outside the 0% to 100% normal range.',
    );
    await expect(resultOutput(page, 'Fair Index')).toHaveText('5,714.11');
    await expect(page.getByRole('region', { name: 'Errors' })).toContainText(
      'Errors (0)',
    );
  });

  test('retains Fair Index but hides comparison for invalid Current Index, then recovers', async ({
    page,
  }) => {
    await openDemo(page);

    const currentIndex = numberInput(page, 'Current Index');
    await currentIndex.fill('0');

    const errors = page.getByRole('region', { name: 'Errors' });
    await expect(errors).toContainText('Errors (1)');
    await expect(errors).toContainText(
      'Current Index must be between 1 and 100000.',
    );
    await expect(
      page.getByRole('region', { name: 'Fair index composition' }),
    ).toContainText('5,577.33');
    await expect(
      page.getByRole('region', { name: 'Market comparison' }),
    ).toContainText('Calculation unavailable');
    await expect(resultOutput(page, 'Fair Index')).toHaveCount(0);
    await expect(
      page.getByRole('img', { name: /Current Index .*; Fair Index/ }),
    ).toHaveCount(0);

    await currentIndex.fill('5000');
    await expect(errors).toContainText('Errors (0)');
    await expectDemoComparison(page);
  });

  test('shows overvaluation against a higher Current Index and Reset restores Demo', async ({
    page,
  }) => {
    await openDemo(page);

    await numberInput(page, 'Current Index').fill('10000');

    await expect(resultOutput(page, 'Fair Index')).toHaveText('5,577.33');
    await expect(resultOutput(page, 'Upside/Downside')).toHaveText('-44.23%');
    await expect(resultOutput(page, 'Premium/Discount to Fair')).toHaveText(
      '79.30% Premium to Fair',
    );
    await expect(resultOutput(page, 'Valuation status')).toHaveText(
      'Overvalued · 고평가',
    );
    await expect(
      page.getByRole('img', {
        name: /Current Index 10,000\.00; Fair Index 5,577\.33; Overvalued/,
      }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Reset Demo', exact: true }).click();
    await expect(numberInput(page, 'Current Index')).toHaveValue('5000');
    await expectDemoComparison(page);
  });

  test('keeps the Pixel 5 flow ordered and free of horizontal page overflow', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chromium',
      'Responsive geometry is asserted only in the Pixel 5 project.',
    );
    await openDemo(page);

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewport).toEqual({
      clientWidth: 393,
      innerWidth: 393,
      scrollWidth: 393,
    });

    const stepNames = [
      'Context & assumptions',
      'Five-year forecast',
      'Discount & terminal value',
      'Fair index composition',
      'Market comparison',
    ];
    const topPositions: number[] = [];
    for (const name of stepNames) {
      const box = await page.getByRole('region', { name }).boundingBox();
      expect(box, `${name} must have a rendered box`).not.toBeNull();
      topPositions.push(box?.y ?? Number.NaN);
    }
    expect(topPositions).toEqual([...topPositions].sort((left, right) => left - right));

    const growthSlider = slider(page, 'EPS Growth Y1');
    await growthSlider.focus();
    await growthSlider.press('ArrowRight');
    await expect(numberInput(page, 'EPS Growth Y1')).toHaveValue('6.1');
    await expect(resultOutput(page, 'Fair Index')).toHaveText('5,582.59');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth ===
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  });
});
