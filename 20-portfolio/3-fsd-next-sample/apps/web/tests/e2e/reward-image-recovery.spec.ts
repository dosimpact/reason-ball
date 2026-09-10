import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

test('NFR-04 preserves reward images and inputs through generation and decode failures', async ({ page }) => {
  await installCleanAppState(page);
  await page.goto('/missions/new');
  await page.getByTestId('mission-prompt').fill('호텔 예약 확인');
  await page.getByTestId('generate-mission-draft').click();
  await expect(page.getByTestId('mission-draft-source')).toHaveText('AI Route 응답');
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.getByRole('button', { name: '다음 단계' }).click();
  const generate = page.getByTestId('generate-reward-image');
  const candidate = page.getByTestId('reward-image-candidate');
  const error = page.getByRole('alert').filter({ hasText: '기존 이미지와 입력은 유지' });
  const requests: unknown[] = [];
  let mode: 'http' | 'success' | 'malformed' | 'decode' = 'http';
  await page.route('**/api/ai/image', async (route) => {
    requests.push(route.request().postDataJSON());
    if (mode === 'http') await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    else if (mode === 'malformed') await route.fulfill({ status: 200, json: { dataUrl: 'https://example.invalid/image.png' } });
    else if (mode === 'decode') await route.fulfill({ status: 200, json: { dataUrl: 'data:image/png;base64,YnJva2Vu' } });
    else await route.continue();
  });
  await page.getByLabel('보상 이름').fill('Keep my reward name');
  await generate.click();
  await expect(error).toBeVisible();
  await expect(candidate).toHaveCount(0);
  await expect(page.getByTestId('reward-candidates')).toBeVisible();
  await expect(page.getByTestId('reward-image-source')).toHaveCount(0);
  mode = 'success';
  await generate.click();
  await expect(candidate).toBeVisible();
  await expect(page.getByTestId('reward-image-source')).toHaveText('AI Route 응답');
  const background = await candidate.locator('[style]').evaluate((element) => (element as HTMLElement).style.backgroundImage);
  for (const failure of ['http', 'malformed', 'decode'] as const) {
    mode = failure;
    await generate.click();
    await expect(error).toBeVisible();
    await expect(candidate).toBeVisible();
    await expect.poll(() => candidate.locator('[style]').evaluate((element) => (element as HTMLElement).style.backgroundImage)).toBe(background);
    await expect(page.getByLabel('보상 이름')).toHaveValue('Keep my reward name');
    await expect(generate).toBeEnabled();
  }
  mode = 'success';
  await generate.click();
  await expect(error).toHaveCount(0);
  await expect(generate).toBeEnabled();
  await expect(candidate).toBeVisible();
  expect(requests).toHaveLength(6);
  for (const request of requests) expect(request).toEqual(requests[0]);
});
