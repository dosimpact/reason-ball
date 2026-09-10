import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

test('NFR-04 preserves the mission draft on HTTP or malformed response failures and retries', async ({ page }) => {
  await installCleanAppState(page);
  await page.goto('/missions/new');
  const title = page.getByTestId('mission-title');
  const prompt = page.getByTestId('mission-prompt');
  const generate = page.getByTestId('generate-mission-draft');
  await prompt.fill('호텔에서 예약 확인하기');
  await generate.click();
  await expect(page.getByTestId('mission-draft-source')).toHaveText('AI Route 응답');
  await title.fill('Keep my edited hotel mission');
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.getByLabel('목표 1', { exact: true }).fill('Keep my custom objective');
  await page.getByLabel('영어 표현 1', { exact: true }).fill('My name is Kim.');
  await page.getByRole('button', { name: '이전', exact: true }).click();

  let attempts = 0;
  const bodies: unknown[] = [];
  await page.route('**/api/ai/mission-draft', async (route) => {
    bodies.push(route.request().postDataJSON());
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    else if (attempts === 2) await route.fulfill({ status: 200, json: { title: 'Must not partially apply', situation: 'Invalid draft', place: 'Wrong place', durationMinutes: 9 } });
    else await route.continue();
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await generate.click();
    await expect(page.getByRole('alert').filter({ hasText: '기존 입력과 초안은 유지' })).toBeVisible();
    await expect(title).toHaveValue('Keep my edited hotel mission');
    await expect(prompt).toHaveValue('호텔에서 예약 확인하기');
    await expect(generate).toBeEnabled();
    await page.getByRole('button', { name: '다음 단계' }).click();
    await expect(page.getByLabel('목표 1', { exact: true })).toHaveValue('Keep my custom objective');
    await expect(page.getByLabel('영어 표현 1', { exact: true })).toHaveValue('My name is Kim.');
    await page.getByRole('button', { name: '이전', exact: true }).click();
  }
  await generate.click();
  await expect(title).toHaveValue('Check In at a Hotel');
  await expect(page.getByRole('alert').filter({ hasText: '기존 입력과 초안은 유지' })).toHaveCount(0);
  expect(attempts).toBe(3);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2]).toEqual(bodies[0]);
});
