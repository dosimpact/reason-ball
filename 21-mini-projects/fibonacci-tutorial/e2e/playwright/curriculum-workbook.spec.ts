import { expect, test, type Page } from '@playwright/test';

async function openFresh(page: Page, unitId: string) {
  const created = await page.request.post('/api/sessions', { data: { unitId } });
  expect(created.status()).toBe(201);
  const session = await created.json();
  await page.goto(`/tutorials/${unitId}?session=${session.id}`);
  return session;
}

test('numeric workbook checks all seven prices, then opens a fresh counterexample', async ({ page }) => {
  await openFresh(page, 'ew-fib-measure');
  await expect(page.locator('.lesson-field input[type=number]')).toHaveCount(7);
  await expect(page.getByRole('button', { name: '예시 비교' })).toBeDisabled();
  await page.getByRole('button', { name: '이 지점 선택' }).click();
  for (const candle of [1, 11, 21]) await page.getByRole('button', { name: new RegExp(`^${candle}번째 캔들`) }).click();
  for (const [name, price] of Object.entries({ '38.2% 되돌림': '112.36', '50% 되돌림': '110', '61.8% 되돌림': '107.64', '78.6% 되돌림': '104.28', '1.0 투사': '130', '1.618 투사': '142.36', '2.618 투사': '162.36' })) {
    await page.getByRole('spinbutton', { name }).fill(price);
  }
  await page.getByRole('textbox', { name: /방향과 부호 설명/ }).fill('상승에서는 E-r(E-S), P+r(E-S); 하락에서는 부호를 그대로 유지합니다.');
  const checked = page.waitForResponse(response => response.url().endsWith('/lesson/check'));
  await page.getByRole('button', { name: '제출하고 피드백 보기' }).click();
  const result = await (await checked).json();
  expect(result.learning.objectivePassed).toBe(true);
  await expect(page.getByText('객관 검사: 통과')).toBeVisible();
  await expect(page.getByRole('button', { name: '예시 비교' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '3번 평가' })).toBeDisabled();
  await page.getByRole('button', { name: '2번 반례' }).click();
  await expect(page.getByText('S·E·P 캔들 인덱스 · 0/3')).toBeVisible();
  for (const name of ['38.2% 되돌림', '2.618 투사']) await expect(page.getByRole('spinbutton', { name })).toHaveValue('');
});

test('M profile switches synchronized charts and chooses parent and child points in their own timeframe', async ({ page }) => {
  await openFresh(page, 'ew-aligned-count');
  await expect(page.getByRole('tab', { name: '1d · 10봉' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '4h · 60봉' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '1h · 240봉' })).toBeVisible();
  await page.getByRole('tab', { name: '4h · 60봉' }).click();
  await expect(page.getByRole('tab', { name: '4h · 60봉' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.timeframe-meta')).toContainText('asOf');
  await page.getByRole('button', { name: '이 지점 선택' }).first().click();
  await expect(page.getByRole('tab', { name: '1d · 10봉' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: /^1d 1번째 봉/ }).click();
  await page.getByRole('button', { name: /^1d 2번째 봉/ }).click();
  await expect(page.getByText('1d 닫힌 상위봉 인덱스 · 2/2')).toBeVisible();
  await page.getByRole('button', { name: '이 지점 선택' }).first().click();
  await expect(page.getByRole('tab', { name: '1h · 240봉' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: /^1h 1번째 봉/ }).click();
  await page.getByRole('button', { name: /^1h 24번째 봉/ }).click();
  await expect(page.getByText('1h 하위 구간 인덱스 · 2/2')).toBeVisible();
  await expect(page.locator('.timeframe-card .chart-canvas')).toBeVisible();
});

test('replay analysis preserves the plan, reveals one candle, and records a reflection', async ({ page }) => {
  await openFresh(page, 'ew-target-zones');
  await page.getByRole('textbox', { name: '패턴', exact: true }).fill('후보 구간');
  await page.getByRole('textbox', { name: '차수', exact: true }).fill('중간 차수');
  await page.getByRole('textbox', { name: '관측 근거' }).fill('공개된 두 기준 구간의 투사 가격이 겹칩니다.');
  await page.getByRole('textbox', { name: '무효화 조건' }).fill('공개 구간의 저점을 이탈하면 다시 분석합니다.');
  await page.getByRole('textbox', { name: '판단 유보 이유' }).fill('후속 봉에서 후보 구간 반응을 확인합니다.');
  await page.getByRole('textbox', { name: '적용한 객관 규칙' }).fill('공개 시점과 기준점 순서를 확인합니다.');
  await page.getByRole('textbox', { name: '가이드라인과 한계' }).fill('Fibonacci 가격은 반전 확정값이 아닙니다.');
  await page.getByRole('textbox', { name: '기준점·측정값' }).fill('S 100, E 120, P 110');
  await page.getByRole('textbox', { name: '다음 관찰 조건' }).fill('후보 구간 도달 또는 무효화 가격 이탈');
  const confirmed = page.waitForResponse(response => response.url().endsWith('/analysis/plan'));
  await page.getByRole('button', { name: '분석 원본 확정' }).click();
  const original = await (await confirmed).json();
  expect(original.analysis.plans).toHaveLength(1);
  const planId = original.analysis.plans[0].id;
  await expect(page.getByRole('button', { name: '분석 원본 확정' })).toBeDisabled();
  const revealed = page.waitForResponse(response => response.url().endsWith('/analysis/replay'));
  await page.getByRole('button', { name: 'Next Candle' }).click();
  const afterReplay = await (await revealed).json();
  expect(afterReplay.cursor).toBe(original.cursor + 1);
  expect(afterReplay.analysis.plans[0].id).toBe(planId);
  await page.getByRole('textbox', { name: '관측 후 회고' }).fill('후속 봉을 확인했고 원래 후보 구간 판단을 유지합니다.');
  const reflected = page.waitForResponse(response => response.url().endsWith('/analysis/reflection'));
  await page.getByRole('button', { name: '회고 저장' }).click();
  const afterReflection = await (await reflected).json();
  expect(afterReflection.analysis.reflections).toHaveLength(1);
  expect(afterReflection.analysis.reflections[0].planId).toBe(planId);
});
