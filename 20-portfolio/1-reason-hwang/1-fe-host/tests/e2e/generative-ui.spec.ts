import { test, expect, type Page } from '@playwright/test';

async function send(page: Page, message: string) {
  await page.getByRole('textbox', { name: '질문', exact: true }).fill(message);
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '중지', exact: true })).toHaveCount(0);
  await expect(page.locator('section > [role="alert"]')).toHaveCount(0);
  return page.locator('article').last();
}

test('Fixed preserves flight, meal and seat actions', async ({ page }) => {
  await page.goto('/a2ui/fixed');
  await send(page, '인천에서 도쿄 가는 가상 항공편을 보여줘');
  await expect(page.locator('article').last()).toContainText('ICN → NRT');
  await page.getByRole('button', { name: '항공편 선택', exact: true }).click();
  await expect(page.locator('article').last()).toContainText('선택 완료 · 실제 예약 아님');
  await expect(page.getByRole('button', { name: '항공편 선택', exact: true })).toBeDisabled();
  for (const [question, fields] of [
    ['같은 항공편의 기내식만 선택할래', ['기내식']],
    ['같은 항공편의 좌석만 선택할래', ['좌석']],
    ['같은 항공편의 기내식과 좌석 모두 선택할래', ['기내식', '좌석']],
  ] as const) {
    const panel = await send(page, question);
    for (const field of fields) await panel.getByRole('combobox', { name: field, exact: true }).selectOption(field === '기내식' ? 'vegetarian' : '14C');
    await expect(panel.getByRole('combobox')).toHaveCount(fields.length);
    await panel.getByRole('button', { name: '선택 확정', exact: true }).click();
    await expect(page.locator('article').last()).toContainText('선택 완료 · 실제 예약 아님');
    for (const field of fields) await expect(page.locator('article').last()).toContainText(field === '기내식' ? '채식' : '14C');
  }
});

test('Dynamic renders real generated UI and recomputes sales', async ({ page }) => {
  await page.goto('/a2ui/dynamic');
  const panel = await send(page, '지역별 매출을 표와 막대 차트로 비교해줘. 금액은 USD로 표시해줘.');
  await expect(panel).toContainText('조회 매출 $680,000 · 거래처 6개');
  await expect(panel.getByRole('table').first()).toBeVisible();
  await expect(panel.getByRole('img', { name: /chart/ }).first()).toBeVisible();
  await panel.getByRole('combobox', { name: '지역', exact: true }).selectOption('seoul');
  await panel.getByRole('button', { name: '매출 조회', exact: true }).click();
  await expect(page.locator('article').last()).toContainText('조회 매출 $360,000 · 거래처 3개');
  await expect(page.getByRole('combobox', { name: '지역', exact: true }).first()).toBeDisabled();
});

test('SEC stored filing selection, citations and reset', async ({ page }) => {
  await page.goto('/a2ui/sec');
  let panel = await send(page, 'AAPL');
  await panel.getByRole('button', { name: '공시 조회', exact: true }).click();
  panel = page.locator('article').last();
  await expect(panel.getByRole('button', { name: '공시 필터 적용', exact: true })).toBeVisible();
  await panel.getByRole('combobox', { name: '원문 저장 상태', exact: true }).selectOption('downloaded');
  await panel.getByRole('combobox', { name: '공시 종류', exact: true }).selectOption('10-K');
  await panel.getByRole('button', { name: '공시 필터 적용', exact: true }).click();
  await expect(page.getByRole('button', { name: '중지', exact: true })).toHaveCount(0);
  panel = page.locator('article').last();
  await panel.getByRole('button', { name: '공시 선택', exact: true }).click();
  panel = page.locator('article').last();
  await panel.getByRole('textbox', { name: '어떤 내용을 분석할까요?', exact: true }).fill('사업의 핵심만 두 항목으로 요약해줘');
  await panel.getByRole('button', { name: '분석·요약 보고서 생성', exact: true }).click();
  await expect(page.locator('article').last()).toContainText('SHA-256');
  await expect(page.locator('article').last()).toContainText('[E1]');
  await page.locator('article').last().getByRole('button', { name: '공시 다시 선택', exact: true }).click();
  await expect(page.locator('article').last().getByRole('button', { name: '공시 필터 적용', exact: true })).toBeVisible();
  await expect(page.locator('article').last()).not.toContainText('SHA-256');
});

test('Catalog search, state, edit and reset', async ({ page }) => {
  await page.goto('/a2ui/catalog');
  await page.getByRole('searchbox', { name: '항목 검색' }).fill('Select');
  await page.getByRole('link', { name: '◇ Select 2', exact: true }).click();
  await page.getByRole('combobox', { name: '도시', exact: true }).selectOption('부산');
  await expect(page.getByText('선택: 부산', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Select 문자열 옵션 코드', exact: true }).fill('root = Col([Text("카탈로그 편집 확인")]);');
  await page.getByRole('button', { name: '코드 적용', exact: true }).first().click();
  await expect(page.getByText('카탈로그 편집 확인', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '초기화', exact: true }).first().click();
  await expect(page.getByRole('combobox', { name: '도시', exact: true })).toHaveValue('서울');
});

test('Cancel and new conversation discard in-flight output', async ({ page }) => {
  await page.goto('/a2ui/dynamic');
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('지역별 매출을 표와 차트로 비교해줘');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('진행 중');
  await page.getByRole('button', { name: '중지', exact: true }).click();
  await expect(page.getByRole('button', { name: '중지', exact: true })).toHaveCount(0);
  await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('button', { name: '새 대화', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveValue('');
  const panel = await send(page, '전체 매출 합계를 짧게 보여줘');
  await expect(panel).toContainText('조회 매출 $680,000 · 거래처 6개');
  await expect(page.locator('article')).toHaveCount(1);
});
