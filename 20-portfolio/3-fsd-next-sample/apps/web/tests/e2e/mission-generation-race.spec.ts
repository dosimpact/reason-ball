import { expect, test, type Page } from '@playwright/test';
import { installCleanAppState } from './test-setup';

type ControlledWindow = typeof window & {
  holdGeneration?: string;
  generationReady?: boolean;
  generationAborted?: boolean;
  generationDelivered?: boolean;
  releaseGeneration?: () => void;
};

async function installDelayedGeneration(page: Page) {
  await installCleanAppState(page);
  await page.addInitScript(() => {
    const state = window as ControlledWindow;
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!state.holdGeneration || !url.endsWith(state.holdGeneration)) return fetch(input, init);
      state.holdGeneration = undefined;
      init?.signal?.addEventListener('abort', () => { state.generationAborted = true; });
      // Deliberately ignore abort to exercise stale-result protection, not just fetch cancellation.
      const response = await fetch(input, { ...init, signal: undefined });
      const payload = await response.json();
      state.generationReady = true;
      await new Promise<void>((resolve) => { state.releaseGeneration = resolve; });
      const delayed = new Response(JSON.stringify(payload), { status: response.status, headers: { 'Content-Type': 'application/json' } });
      const json = delayed.json.bind(delayed);
      delayed.json = async () => { const value = await json(); state.generationDelivered = true; return value; };
      return delayed;
    };
  });
}

async function hold(page: Page, path: string) {
  await page.evaluate((path) => {
    Object.assign(window, { holdGeneration: path, generationReady: false, generationAborted: false, generationDelivered: false });
  }, path);
}

async function release(page: Page) {
  await page.evaluate(() => (window as ControlledWindow).releaseGeneration?.());
  await expect.poll(() => page.evaluate(() => (window as ControlledWindow).generationDelivered)).toBe(true);
}

test('preserves manual edits and a newer draft after a cancelled late draft response', async ({ page }) => {
  await installDelayedGeneration(page);
  await page.goto('/missions/new');
  const title = page.getByTestId('mission-title');
  const generate = page.getByTestId('generate-mission-draft');
  await title.fill('Original draft');
  await hold(page, '/api/ai/mission-draft');
  await generate.click();
  await expect.poll(() => page.evaluate(() => (window as ControlledWindow).generationReady)).toBe(true);
  await title.fill('My newer manual title');
  await expect(page.getByRole('status').filter({ hasText: '생성을 취소했어요' })).toBeVisible();
  expect(await page.evaluate(() => (window as ControlledWindow).generationAborted)).toBe(true);
  await release(page);
  await expect(title).toHaveValue('My newer manual title');
  await expect(page.getByTestId('mission-draft-source')).toHaveCount(0);
  await generate.click();
  await expect(title).toHaveValue('Check In at a Hotel');
  await hold(page, '/api/ai/mission-draft');
  await generate.click();
  await expect.poll(() => page.evaluate(() => (window as ControlledWindow).generationReady)).toBe(true);
  await page.getByRole('button', { name: 'AI 생성 취소', exact: true }).click();
  await generate.click();
  await expect(generate).toBeEnabled();
  await title.fill('Edited after replacement generation');
  await release(page);
  await expect(title).toHaveValue('Edited after replacement generation');
});

test('cancels reward generation on edits or navigation and never installs its late image', async ({ page }) => {
  await installDelayedGeneration(page);
  await page.goto('/missions/new');
  await page.getByTestId('mission-prompt').fill('Hotel check-in');
  await page.getByTestId('generate-mission-draft').click();
  await expect(page.getByTestId('mission-draft-source')).toHaveText('AI Route 응답');
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.getByRole('button', { name: '다음 단계' }).click();
  const generate = page.getByTestId('generate-reward-image');
  await hold(page, '/api/ai/image');
  await generate.click();
  await expect.poll(() => page.evaluate(() => (window as ControlledWindow).generationReady)).toBe(true);
  await expect(page.getByTestId('save-mission')).toBeDisabled();
  await page.getByLabel('보상 이름').fill('Keep my new reward');
  await release(page);
  await expect(page.getByTestId('reward-image-candidate')).toHaveCount(0);
  await expect(page.getByLabel('보상 이름')).toHaveValue('Keep my new reward');
  await expect(page.getByTestId('save-mission')).toBeEnabled();
  await hold(page, '/api/ai/image');
  await generate.click();
  await expect.poll(() => page.evaluate(() => (window as ControlledWindow).generationReady)).toBe(true);
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await release(page);
  await page.getByRole('button', { name: '다음 단계' }).click();
  await expect(page.getByTestId('reward-image-candidate')).toHaveCount(0);
  await generate.click();
  await expect(page.getByTestId('reward-image-candidate')).toBeVisible();
});
