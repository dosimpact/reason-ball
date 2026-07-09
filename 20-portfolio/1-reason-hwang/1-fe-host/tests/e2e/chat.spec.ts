import { expect, test } from '@playwright/test';

test('streams a LangGraph assistant response in chat', async ({ page }) => {
  const langGraphRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();

    if (url.includes('/threads') || url.includes('/api/langgraph')) {
      langGraphRequests.push(url);
    }
  });

  await page.goto('/chat');

  await page.getByRole('textbox', { name: 'Message' }).fill('Say ok');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText('You')).toBeVisible();
  await expect(page.getByText('Say ok')).toBeVisible();
  await expect(page.getByText('Assistant')).toBeVisible();
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
