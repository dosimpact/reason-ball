import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

for (const width of [1280, 360]) {
  test(`preserves the draft and blocks chat until mission start recovers at ${width}px`, async ({ page }) => {
    await installCleanAppState(page);
    await page.setViewportSize({ width, height: 800 });
    let denied = true;
    let chatRequests = 0;
    const starts: unknown[] = [];
    page.on('request', (request) => { if (request.url().endsWith('/api/ai/chat')) chatRequests++; });
    // DB enforcement is tested with PGlite; this is the browser's rejection/retry contract.
    await page.route('**/api/mission-runs', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      starts.push(route.request().postDataJSON());
      if (denied) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'MISSION_PREREQUISITES_REQUIRED', message: '선수 미션을 먼저 완료해 주세요.' } }) });
      await route.continue();
    });
    await page.goto('/chat/mia-hotelier?mission=hotel-check-in');
    await expect(page.getByTestId('mission-start-status')).toContainText('선수 미션을 먼저 완료');
    const input = page.getByTestId('chat-input');
    await input.fill('Hello, I would like to check in.');
    await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeDisabled();
    await input.press('Enter');
    await page.getByRole('button', { name: '답변 다시 생성', exact: true }).first().click();
    await expect(input).toHaveValue('Hello, I would like to check in.');
    expect(chatRequests).toBe(0);
    const rejectedInput = starts.at(-1);
    denied = false;
    await page.getByRole('button', { name: '미션 시작 다시 시도', exact: true }).click();
    await expect(page.getByTestId('mission-start-status')).toHaveCount(0);
    expect(starts.at(-1)).toEqual(rejectedInput);
    await expect(input).toHaveValue('Hello, I would like to check in.');
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
    await expect.poll(() => chatRequests).toBe(1);
    await expect(input).toHaveValue('');
  });
}
