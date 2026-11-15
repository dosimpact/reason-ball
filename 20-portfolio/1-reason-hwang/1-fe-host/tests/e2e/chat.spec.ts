import { expect, test } from '@playwright/test';

test('streams a LangGraph assistant response in chat', async ({ page }) => {
  const langGraphRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();

    if (url.includes('/threads') || url.includes('/api/langgraph')) {
      langGraphRequests.push(url);
    }
  });

  await page.route('**/api/langgraph/threads', route => route.fulfill({ json: { thread_id: 'fixture-thread' } }));
  await page.route('**/api/langgraph/threads/fixture-thread/runs/stream', route => route.fulfill({ contentType: 'text/event-stream', body: 'event: values\ndata: '+JSON.stringify({ messages: [{ type: 'ai', content: 'ok' }] })+'\n\n' }));
  await page.goto('/langgraph-dev-chat');

  await page.locator('textarea:visible').first().fill('Say ok');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();

  await expect(page.getByText('Say ok')).toBeVisible();
  await expect(page.getByText(/^ok$/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('An internal error occurred')).toHaveCount(0);
  expect(langGraphRequests).toEqual(
    expect.arrayContaining([
      expect.stringContaining('/api/langgraph/threads'),
      expect.stringContaining('/runs/stream'),
    ]),
  );
  expect(langGraphRequests).not.toEqual(
    expect.arrayContaining([expect.stringContaining('127.0.0.1:2024')]),
  );
});
