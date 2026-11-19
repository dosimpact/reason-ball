import { expect, test } from '@playwright/test';

const timeline = '.openui-behind-the-scenes:not(:has(.openui-behind-the-scenes__toggle--static))';
async function send(page: import('@playwright/test').Page, text: string) {
  const composer = page.locator('textarea:visible').first();
  await composer.fill(text);
  await composer.press('Enter');
}
test.beforeEach(async ({ page, request }) => {
  expect(Array.isArray(await request.get('/api/langgraph/__calls').then(response => response.json()))).toBeTruthy();
  await page.goto('/langgraph-dev-chat');
  await page.locator('select[aria-label="LangGraph 에이전트"]:visible').selectOption('starter_graph');
});

test('native timeline precedes answer once per turn and restored history remains safe', async ({ page }) => {
  await expect(page.locator('.agent-conversation__status')).toHaveCount(0);
  await send(page, 'tools-complete native restore');
  await expect(page.getByText('Safe fixture assistant answer', { exact: true })).toBeVisible();
  await expect(page.locator(timeline)).toHaveCount(1);
  const before = await page.locator(timeline).boundingBox();
  const answer = await page.locator('.agent-conversation__answer').boundingBox();
  expect(before!.y).toBeLessThan(answer!.y);
  await page.locator(timeline).locator('button').first().click();
  await expect(page.locator(timeline).locator('.openui-behind-the-scenes__item')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('SECRET_ARGUMENT');
  await expect(page.locator('body')).not.toContainText('SECRET_TOOL_RESULT');
  await send(page, 'tools-error second turn');
  await expect(page.locator(timeline)).toHaveCount(2);
  await expect(page.locator(timeline).last()).toContainText('failed');
  await page.locator('button:visible').filter({ hasText: /^새 대화$/ }).click();
  await expect(page.locator(timeline)).toHaveCount(0);
  await page.locator('summary:visible').click();
  await page.getByRole('button', { name: /tools-complete native restore/ }).first().click();
  await expect(page.locator(timeline)).toHaveCount(2);
  await expect(page.locator('.agent-conversation__answer')).toHaveCount(2);
  await expect(page.locator('body')).not.toContainText('SECRET_TOOL_RESULT');
});

test('running uses native timeline without status stripe and cancellation settles safely', async ({ page }) => {
  await send(page, 'tools-interrupt');
  await expect(page.locator(timeline)).toHaveCount(1);
  await expect(page.locator(timeline)).toHaveClass(/working/);
  await expect(page.locator('.agent-conversation__status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel message', exact: true }).click();
  await expect(page.locator('select[aria-label="LangGraph 에이전트"]:visible')).toBeEnabled();
  await expect(page.locator(timeline)).toHaveClass(/settled/);
  await page.locator(timeline).locator('button').first().click();
  await page.locator(timeline).locator('.openui-behind-the-scenes__item button').first().click();
  await expect(page.locator(timeline)).toContainText('실행이 중단되었습니다.');
  await page.locator('button:visible').filter({ hasText: /^새 대화$/ }).click();
  await send(page, 'plain tool-free turn');
  await expect(page.getByText('Fixture reply for starter_graph', { exact: true })).toBeVisible();
  await expect(page.locator(timeline)).toHaveCount(0);
});
