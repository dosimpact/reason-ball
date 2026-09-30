import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

test('CHAR-02 preserves candidates on partial failure and requires selection after regeneration', async ({ page }) => {
  await installCleanAppState(page);
  await page.goto('/characters/new');
  await page.getByTestId('character-name').fill('Recovery Sophie');
  await page.getByTestId('character-role').fill('Travel guide');
  await page.getByRole('button', { name: '다음 단계' }).click();
  await page.getByTestId('character-persona-goal').fill('Help visitors feel welcome.');
  await page.getByTestId('character-learning-goal').fill('Practice short travel questions.');
  await page.getByRole('button', { name: '다음 단계' }).click();
  let mode: 'partial' | 'decode' | 'success' = 'partial';
  let requests = 0;
  await page.route('**/api/ai/image', async (route) => {
    const index = requests++ % 3;
    if (mode === 'partial' && index === 1) await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    else if (mode === 'decode' && index === 2) await route.fulfill({ status: 200, json: { dataUrl: 'data:image/png;base64,YnJva2Vu' } });
    else await route.fulfill({ status: 200, json: {
      // UI recovery fixture. Real generation remains covered by character-builder/content-versioning.
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${['red', 'blue', 'green'][index]}"/></svg>`).toString('base64')}`,
    } });
  });
  const error = page.getByRole('alert').filter({ hasText: '기존 후보와 선택, 입력은 유지' });
  await page.getByTestId('generate-character-images').click();
  await expect(error).toBeVisible();
  await expect(page.getByTestId('image-generation-source')).toHaveCount(0);
  await expect(page.getByTestId('character-image-candidates')).toHaveCount(0);
  mode = 'success';
  await page.getByTestId('generate-character-images').click();
  const candidates = page.getByTestId('character-image-candidates');
  await expect(candidates.getByRole('button')).toHaveCount(3);
  await expect(candidates.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId('character-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'AI 캐릭터 시안 2', exact: true }).click();
  const selected = candidates.getByRole('button', { name: 'AI 캐릭터 시안 2', exact: true });
  const background = await selected.locator('[style]').getAttribute('style');
  const regenerate = page.getByTestId('regenerate-character-images');
  for (const failure of ['partial', 'decode'] as const) {
    mode = failure;
    await regenerate.click();
    await expect(error).toBeVisible();
    await expect(regenerate).toBeEnabled();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(selected.locator('[style]')).toHaveAttribute('style', background!);
    await expect(page.getByTestId('character-preview')).toContainText('Recovery Sophie');
  }
  mode = 'success';
  await regenerate.click();
  await expect(regenerate).toBeEnabled();
  await expect(error).toHaveCount(0);
  await expect(candidates.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId('character-preview')).toHaveCount(0);
  await page.getByTestId('save-character').click();
  await expect(page.getByRole('alert').filter({ hasText: '후보를 직접 선택' })).toBeVisible();
  await candidates.getByRole('button', { name: 'AI 캐릭터 시안 3', exact: true }).click();
  await page.getByTestId('save-character').click();
  await expect(page).toHaveURL(/\/characters\/recovery-sophie-\d+\?created=1$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Recovery Sophie' })).toBeVisible();
});
