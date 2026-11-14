import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  // Refuse to execute collection scenarios against a real BFF.
  const fixture = await request.get('/api/remote-proxy/__calls');
  expect(fixture.ok(), 'Start tests/e2e/fixtures/sec-collector-server.mjs upstream').toBeTruthy();
  expect(Array.isArray(await fixture.json())).toBeTruthy();
  await page.goto('/sec-collector');
});

test('server totals, company paging, selected scope and refresh', async ({ page }) => {
  const overview = page.getByRole('region', { name: '수집 현황' });
  await expect(overview).toContainText('12');
  await expect(overview).toContainText('15');
  const companies = page.locator('section').filter({ has: page.getByRole('heading', { name: '기업 목록', exact: true }) });
  await companies.getByRole('button', { name: '다음', exact: true }).click();
  await expect(companies.getByText('TEST9', { exact: true })).toBeVisible();
  await companies.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByRole('checkbox', { name: '기업 선택 AAPL', exact: true }).check();
  await page.getByRole('button', { name: '공시 보기 AAPL', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'CIK', exact: true })).toHaveValue('0000320193');
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '기업 선택 AAPL', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '공시 보기 MSFT', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'CIK', exact: true })).toHaveValue('0000789019');
  await expect(page.getByRole('table', { name: '저장된 공시 목록' })).toContainText('0000789019-26-000100');
  await page.getByRole('button', { name: '전체 공시', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'CIK', exact: true })).toHaveValue('');
});

test('selected SSE distinguishes partial, terminal error and missing terminal', async ({ page }) => {
  for (const [ticker, label] of [['PARTIAL', '일부 실패'], ['ERROR', '오류'], ['INCOMPLETE', '연결 중단']]) {
    await page.getByRole('textbox', { name: '추가 티커', exact: true }).fill(ticker);
    await page.getByRole('button', { name: '선택 기업 수집 준비' }).click();
    await page.getByRole('checkbox', { name: '수집 대상과 기간을 확인했습니다.' }).check();
    await page.getByRole('button', { name: '수집 시작', exact: true }).click();
    const history = page.locator('section').filter({ has: page.getByRole('heading', { name: '현재 세션 실행 기록', exact: true }) });
    await expect(history.locator('li').first()).toContainText(label);
    await expect(page.getByRole('button', { name: '기업 디렉터리 동기화' })).toBeEnabled();
  }
});

test('confirmed bulk uses fixture only and completes split SSE', async ({ page }) => {
  await expect(page.getByRole('spinbutton', { name: '조회 기간(년)' })).toHaveValue('20');
  await page.getByRole('button', { name: '전체 기업 수집 준비' }).click();
  await expect(page.getByRole('button', { name: '수집 시작', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: '수집 대상과 기간을 확인했습니다.' }).check();
  await page.getByRole('button', { name: '수집 시작', exact: true }).click();
  const history = page.locator('section').filter({ has: page.getByRole('heading', { name: '현재 세션 실행 기록', exact: true }) });
  await expect(history.locator('li').first()).toContainText('완료');
  await expect(history.locator('li').first()).toContainText('completed');
});
