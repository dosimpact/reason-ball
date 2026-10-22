import { test, expect } from '@playwright/test';

// SEC-IUI-004: deterministic UI boundary coverage; real provider covered separately.
const apple = { cik: '0000320193', ticker: 'AAPL', name: 'Apple Inc.' };
const prepared = { threadId: 'a'.repeat(32), filing: { accessionNo: 'fixture-filing', filingDate: '2025-10-31' }, checkedAt: 'fixture', missingItems: [] };

test('conversation: starts with a composer, handles ordinary replies and resets', async ({ page }) => {
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: '안녕하세요. 편하게 질문해 주세요.', followUps: ['10-K를 설명해줘', '애플의 사업은?', '위험요인을 읽는 법은?'] } }));
  await page.goto('/sec-chat');
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '기업명 또는 티커' })).toHaveCount(0);
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('안녕');
  await page.getByRole('textbox', { name: '메시지', exact: true }).press('Enter');
  await expect(page.getByText('안녕하세요. 편하게 질문해 주세요.', { exact: true })).toBeVisible();
  const followUps = page.getByRole('navigation', { name: '다음 추천 질문' });
  await expect(followUps.getByRole('button')).toHaveCount(3);
  await followUps.getByRole('button', { name: '10-K를 설명해줘', exact: true }).click();
  await expect(page.locator('.sec-message-user').last()).toHaveText('10-K를 설명해줘');
  await expect(page.locator('.sec-message-assistant')).toHaveCount(2);
  await expect(followUps.first().getByRole('button').first()).toBeDisabled();
  await page.getByRole('button', { name: '새 대화', exact: true }).click();
  await expect(page.getByRole('heading', { name: '무엇이 궁금하세요?' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('conversation: company clarification preserves the original question', async ({ page }) => {
  let chatBody: Record<string, unknown> = {};
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'choose', reply: '어느 기업을 말씀하셨나요?', companies: [apple], question: '애플의 사업 구조를 요약해줘', refresh: false } }));
  await page.route('**/api/sec-chat/prepare', async route => {
    expect(route.request().postDataJSON()).toEqual({ cik: apple.cik, refresh: true });
    await route.fulfill({ json: prepared });
  });
  await page.route('**/api/sec-chat/chat', async route => {
    chatBody = route.request().postDataJSON();
    const events = [{ type: 'TEXT_MESSAGE_CONTENT', delta: 'root = Text("공시 기반 테스트 답변")' }, { type: 'CUSTOM', name: 'sec.follow-ups', value: { questions: ['매출 비중은?', '주요 위험은?', '현금흐름은?'], status: 'ready' } }, { type: 'RUN_FINISHED' }];
    await route.fulfill({ contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') });
  });
  await page.goto('/sec-chat');
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('애플의 사업 구조를 요약해줘');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await page.getByRole('button', { name: 'AAPL Apple Inc.' }).click();
  await expect(page.getByTestId('intelligent-ui-answer').last()).toContainText('공시 기반 테스트 답변');
  await expect(page.getByRole('navigation', { name: '다음 추천 질문' }).getByRole('button')).toHaveCount(3);
  expect(chatBody).toEqual({ threadId: prepared.threadId, message: '애플의 사업 구조를 요약해줘' });
});

test('conversation: failure restores input and retry succeeds', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/sec-chat/resolve', route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 502, json: { detail: '일시적인 연결 오류' } }) : route.fulfill({ json: { action: 'reply', reply: '다시 연결됐어요.' } });
  });
  await page.goto('/sec-chat');
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('안녕');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '일시적인 연결 오류' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('안녕');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByText('다시 연결됐어요.', { exact: true })).toBeVisible();
});

test('conversation: cancel preserves the question without a successful answer', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sec-chat/resolve', async route => {
    await gate;
    await route.fulfill({ json: { action: 'reply', reply: '취소 후 표시하면 안 되는 답변' } }).catch(() => undefined);
  });
  try {
    await page.goto('/sec-chat');
    await page.getByRole('textbox', { name: '메시지', exact: true }).fill('애플 분석해줘');
    await page.getByRole('button', { name: '메시지 보내기' }).click();
    await page.getByRole('button', { name: '답변 중단' }).click();
    await expect(page.locator('.sec-error')).toContainText('중단했어요');
    await expect(page.locator('.sec-timeline').last()).toContainText('중단됨');
    await expect(page.getByRole('textbox', { name: '메시지', exact: true })).toHaveValue('애플 분석해줘');
    await expect(page.getByText('취소 후 표시하면 안 되는 답변', { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test('conversation: live timeline collapses after completion and preserves failure status', async ({ page }) => {
  const activity = (status: string) => ({ type: 'CUSTOM', name: 'sec.activity', value: { id: 'step-1', label: '메시지 해석', status, kind: 'node' } });
  let attempts = 0;
  await page.route('**/api/sec-chat/resolve', route => {
    attempts++;
    const events = attempts === 1
      ? [activity('running'), activity('completed'), { type: 'CUSTOM', name: 'sec.resolution', value: { action: 'reply', reply: '분석 준비가 됐어요.' } }, { type: 'RUN_FINISHED' }]
      : [activity('running'), activity('failed'), { type: 'RUN_ERROR', message: '작업에 실패했어요.' }];
    return route.fulfill({ contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') });
  });
  await page.goto('/sec-chat');
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('안녕');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByText('분석 준비가 됐어요.', { exact: true })).toBeVisible();
  const first = page.locator('.sec-timeline').first();
  await expect(first).not.toHaveAttribute('open', '');
  await first.locator('summary').click();
  await expect(first.locator('.sec-activity-label').filter({ hasText: '메시지 해석' })).toBeVisible();
  await expect(first.locator('li[data-status="completed"]')).toHaveCount(2);
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('다음 질문');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.locator('.sec-error')).toContainText('작업에 실패했어요.');
  const last = page.locator('.sec-timeline').last();
  await expect(last).toContainText('일부 작업 실패');
  await last.locator('summary').click();
  await expect(last.locator('li[data-status="failed"]')).toHaveCount(2);
  await expect(first.locator('li[data-status="completed"]')).toHaveCount(2);
});

test('conversation: legacy prose reply uses OpenUI markdown', async ({ page }) => {
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: '### 일회성 수익 찾기\n\n- **매각이익**을 확인하세요.', followUps: [] } }));
  await page.goto('/sec-chat');
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('재무제표 주석 읽는 법');
  await page.getByRole('textbox', { name: '메시지', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: '일회성 수익 찾기' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '매각이익' })).toBeVisible();
  await expect(page.locator('.sec-message-assistant strong')).toHaveText('매각이익');
});
