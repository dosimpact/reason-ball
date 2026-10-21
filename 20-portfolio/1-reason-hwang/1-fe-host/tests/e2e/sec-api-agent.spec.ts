import { test, expect } from '@playwright/test';

const events = [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'TOOL_CALL_START', toolCallId: 'lookup', toolCallName: 'search_sec_companies' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'lookup', delta: '{"ticker":"AAPL"}' },
  { type: 'TOOL_CALL_END', toolCallId: 'lookup' },
  { type: 'TOOL_CALL_RESULT', toolCallId: 'lookup', messageId: 'tool-result', content: '{"status":"completed"}' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'answer', delta: 'root = Col([Title("기업 조회 결과", "lg"), Markdown("**Apple Inc.** · 0000320193")])' },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' },
];

test('admin: OpenUI answer, actual transport timeline and responsive shell', async ({ page }) => {
  await page.route('**/api/sec-api-agent', route => route.fulfill({ contentType: 'text/event-stream', body: events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') }));
  await page.goto('/sec-api-agent');
  await page.getByRole('button', { name: '기업 검색', exact: true }).click();
  await expect(page.getByRole('heading', { name: '기업 조회 결과' })).toBeVisible();
  await page.getByRole('button', { name: 'Behind the scenes', exact: true }).click();
  await expect(page.getByText('Used search sec companies').first()).toBeVisible();
  await page.getByRole('button', { name: '새 대화', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SEC 데이터로 무엇을 할까요?' })).toBeVisible();
  await page.locator('.sec-agent-history:visible summary').click();
  await page.locator('.sec-agent-history-panel:visible').getByRole('button', { name: '저장된 SEC 기업에서 AAPL을 찾아줘.', exact: true }).click();
  await expect(page.getByRole('heading', { name: '기업 조회 결과' })).toBeVisible();
  await page.locator('.sec-agent-history:visible summary').click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('textbox')).toBeVisible();
  }
});

test('admin: upstream failure is visible', async ({ page }) => {
  await page.route('**/api/sec-api-agent', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"RUN_ERROR","message":"SEC test failure"}\n\n' }));
  await page.goto('/sec-api-agent');
  await page.getByRole('button', { name: '기업 검색', exact: true }).click();
  await expect(page.getByText('SEC test failure', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('textbox')).toBeVisible();
});
