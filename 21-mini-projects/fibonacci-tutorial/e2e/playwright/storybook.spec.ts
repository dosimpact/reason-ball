import { test, expect } from '@playwright/test';
const cases = [
  ['loading', '차트와 학습 기록을 준비하고 있습니다…'],
  ['error', '저장된 세션을 찾을 수 없습니다.'],
  ['theory-step', 'Impulse: 시작점과 1파'],
  ['six-point-count', '선택 검증'],
  ['rule-feedback', '3파는 가장 짧을 수 없습니다.'],
  ['fibonacci-practice', '5. Fibonacci 연습'],
  ['draft-trade', '작성 중'],
  ['confirmed-plan', '확정됨'],
  ['evaluated-result', '목표가 도달'],
  ['market-lab', '시간 경과 후 시장 평가'],
  ['five-step-theory', '확인 질문 · 3문항 중 2문항 통과'],
  ['numeric-workbook', '분석 워크북'],
  ['monitor-pending', '진입 대기'],
  ['monitor-open', '모의 포지션 진행'],
  ['monitor-warning', '경계 접근'],
  ['monitor-invalidated', '파동 무효화로 중단'],
  ['monitor-aborted', '수동 중단'],
] as const;
for (const [story, expected] of cases) {
  test(`isolated UI: ${story}`, async ({ page }) => {
    const errors: string[] = [];
    const apiRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
    await page.goto(`${process.env.STORYBOOK_URL}/iframe.html?id=tutorial-complete-learning-flow--${story}&viewMode=story`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
    if (!['loading', 'error'].includes(story) && !story.startsWith('monitor-')) await expect(page.getByRole('img', { name: /공개된 가격/ }).locator('canvas').first()).toBeVisible();
    if (story === 'numeric-workbook') await expect(page.locator('.lesson-field input[type=number]')).toHaveCount(7);
    if (story === 'confirmed-plan') await expect(page.getByRole('button', { name: 'Next Candle' })).toBeEnabled();
    if (story === 'draft-trade' || story === 'evaluated-result') await expect(page.getByRole('button', { name: 'Next Candle' })).toBeDisabled();
    if (story === 'evaluated-result') await expect(page.locator('.evaluation-body').getByText('+1.89R', { exact: true })).toBeVisible();
    expect(errors).toEqual([]); expect(apiRequests).toEqual([]);
  });
}

for (const story of ['confirmed-plan', 'numeric-workbook']) {
  test(`Primer dark UI: ${story}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.STORYBOOK_URL}/iframe.html?id=tutorial-complete-learning-flow--${story}&viewMode=story&globals=theme:dark`);
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 17, 23)');
    await expect(page.locator('.chart-canvas canvas').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

const strategyCases = [
  ['empty-list', '저장된 전략이 없습니다'],
  ['draft-plan', '2. 파동과 계획 작성'],
  ['forward-waiting', '3. 포워드 테스트 실행'],
  ['completed-run', '실행 평가'],
  ['error-state', '저장된 전략을 찾을 수 없습니다. 전략 목록에서 다시 열어 주세요.'],
  ['run-error', '오류 확인 후 재개'],
] as const;
for (const [story, expected] of strategyCases) {
  test(`independent strategy UI: ${story}`, async ({ page }) => {
    const errors: string[] = [];
    const apiRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
    await page.goto(`${process.env.STORYBOOK_URL}/iframe.html?id=strategy-workspace-independent-strategy--${story}&viewMode=story`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
    if (story === 'draft-plan') {
      await expect(page.getByRole('button', { name:'초안 저장', exact:true })).toBeEnabled();
      await expect(page.getByRole('button', { name:'계획 확정', exact:true })).toBeDisabled();
    }
    if (story === 'run-error') await expect(page.getByRole('button', { name:'새 확정봉 확인' })).toBeDisabled();
    if (story === 'completed-run') await expect(page.getByRole('button', { name:'계획 중단 · 모의 청산' })).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
}
test('independent strategy draft uses Primer dark tokens', async ({ page }) => {
  await page.goto(`${process.env.STORYBOOK_URL}/iframe.html?id=strategy-workspace-independent-strategy--draft-plan&viewMode=story&globals=theme:dark`);
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  await expect(page.getByRole('region', { name:'전략 계획 초안' })).toHaveCSS('background-color', 'rgb(13, 17, 23)');
  await expect(page.getByLabel('계획 요약')).toHaveValue('2파 저점 확인 후 계획을 검토합니다.');
});
