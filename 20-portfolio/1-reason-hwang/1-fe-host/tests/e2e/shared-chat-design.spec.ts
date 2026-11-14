import { expect, test, type Page } from '@playwright/test';

const answer = '공통 디자인 응답';
const markdown = `### ${answer}\n\n**업무 결과**가 유지됩니다.`;
const program = `root = Col([Markdown(${JSON.stringify(markdown)})])`;
const sse = (events: unknown[]) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');

async function mockChat(page: Page, path: string) {
  if (path === '/chat') {
    await page.route('**/api/langgraph/threads', route => route.fulfill({ json: { thread_id: 'shared-design-thread' } }));
    await page.route('**/api/langgraph/threads/shared-design-thread/runs/stream', route => route.fulfill({
      contentType: 'text/event-stream',
      body: `event: values\ndata: ${JSON.stringify({ messages: [{ type: 'ai', content: markdown }] })}\n\n`,
    }));
  } else if (path === '/sec-chat') {
    await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: markdown, followUps: ['후속 질문'] } }));
  } else if (path === '/sec-api-agent') {
    await page.route('**/api/sec-api-agent', route => route.fulfill({ contentType: 'text/event-stream', body: sse([
      { type: 'RUN_STARTED', threadId: 'shared-design-thread', runId: 'shared-design-run' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'shared-design-answer', delta: program },
      { type: 'RUN_FINISHED', threadId: 'shared-design-thread', runId: 'shared-design-run' },
    ]) }));
  } else {
    await page.route('**/api/generative-ui/dynamic', route => route.fulfill({ contentType: 'text/event-stream', body: sse([
      { type: 'CUSTOM', name: 'ui.output', value: { program, controls: '', revision: 1 } },
      { type: 'RUN_FINISHED' },
    ]) }));
  }
}

for (const path of ['/chat', '/sec-chat', '/sec-api-agent', '/open-ui/dynamic']) {
  test(`shared chat frame: ${path} preserves its response and reset`, async ({ page }) => {
    await mockChat(page, path);
    await page.goto(path);
    const frame = page.locator('[data-slot="agent-chat-frame"]');
    await expect(frame).toHaveCount(1);
    const input = frame.locator('textarea:visible').first();
    await expect(input).toBeVisible();
    await expect(frame.getByRole('button', { name: '새 대화', exact: true }).first()).toBeVisible();
    await input.fill('공통 UI 확인');
    await input.press('Enter');
    await expect(frame.getByRole('heading', { name: answer, exact: true })).toBeVisible();
    await expect(frame.locator('strong').filter({ hasText: '업무 결과' })).toBeVisible();
    await frame.locator('textarea:visible').first().fill('작성 중 초안');
    await frame.getByRole('button', { name: '새 대화', exact: true }).first().click();
    await expect(frame.getByRole('heading', { name: answer, exact: true })).toHaveCount(0);
    await expect(frame.locator('textarea:visible').first()).toHaveValue('');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(frame.locator('textarea:visible').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  });
}
