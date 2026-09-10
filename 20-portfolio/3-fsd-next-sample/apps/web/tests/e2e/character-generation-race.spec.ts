import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

type GenerationWindow = typeof window & { holdImages?: boolean; imageReleases: Array<() => void>; abortedImages: number; deliveredImages: number; decodedImages: number };

test('cancels all character image requests on navigation and preserves newer selections', async ({ page }) => {
  await installCleanAppState(page);
  await page.addInitScript(() => {
    const state = window as GenerationWindow;
    state.imageReleases = []; state.abortedImages = 0; state.deliveredImages = 0; state.decodedImages = 0;
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      state.decodedImages++;
    };
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.endsWith('/api/ai/image')) return fetch(input, init);
      const delayed = state.holdImages;
      if (delayed) {
        init?.signal?.addEventListener('abort', () => { state.abortedImages++; });
        // Ignore abort deliberately to verify the UI also rejects stale successful responses.
        await new Promise<void>((resolve) => state.imageReleases.push(resolve));
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${delayed ? 'red' : 'blue'}"/></svg>`;
      const response = new Response(JSON.stringify({ dataUrl: `data:image/svg+xml;base64,${btoa(svg)}` }), { status: 200 });
      const json = response.json.bind(response);
      response.json = async () => { const payload = await json(); if (delayed) state.deliveredImages++; return payload; };
      return response;
    };
  });
  await page.goto('/characters/new');
  await page.getByTestId('character-name').fill('Race Sophie');
  await page.getByTestId('character-role').fill('Travel guide');
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.getByTestId('character-persona-goal').fill('Welcome visitors.');
  await page.getByTestId('character-learning-goal').fill('Practice travel questions.');
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.evaluate(() => { (window as GenerationWindow).holdImages = true; });
  await page.getByTestId('generate-character-images').click();
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).imageReleases.length)).toBe(3);
  await expect(page.getByTestId('save-character')).toBeDisabled();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByTestId('character-persona-goal').fill('Keep my revised goal.');
  expect(await page.evaluate(() => (window as GenerationWindow).abortedImages)).toBe(3);
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.evaluate(() => { (window as GenerationWindow).holdImages = false; });
  await page.getByTestId('generate-character-images').click();
  const candidate = page.getByRole('button', { name: 'AI 캐릭터 시안 2', exact: true });
  await candidate.click();
  const style = await candidate.locator('[style]').getAttribute('style');
  await page.evaluate(() => { for (const release of (window as GenerationWindow).imageReleases) release(); });
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).deliveredImages)).toBe(3);
  // Wait beyond JSON delivery: stale results only reach the application guard after decoding.
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).decodedImages)).toBe(6);
  await expect(candidate).toHaveAttribute('aria-pressed', 'true');
  await expect(candidate.locator('[style]')).toHaveAttribute('style', style!);
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByTestId('character-persona-goal')).toHaveValue('Keep my revised goal.');
  await page.getByRole('button', { name: '다음 단계' }).click();

  await page.evaluate(() => { (window as GenerationWindow).holdImages = true; });
  await page.getByTestId('regenerate-character-images').click();
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).imageReleases.length)).toBe(6);
  await page.getByRole('button', { name: '이미지 생성 취소', exact: true }).click();
  await expect(candidate).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('save-character')).toBeEnabled();
  await page.getByTestId('regenerate-character-images').click();
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).imageReleases.length)).toBe(9);
  // Client-side route navigation unmounts the form without discarding our delayed promises.
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '캐릭터', exact: true }).click();
  await expect(page).toHaveURL('/characters');
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).abortedImages)).toBe(9);
  await page.evaluate(() => { for (const release of (window as GenerationWindow).imageReleases) release(); });
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).deliveredImages)).toBe(9);
  await expect.poll(() => page.evaluate(() => (window as GenerationWindow).decodedImages)).toBe(12);
  await expect(page.getByTestId('character-builder')).toHaveCount(0);
});
