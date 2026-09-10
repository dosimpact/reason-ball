import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

test('restores a private file reference for its viewer but never fetches it from a shared view', async ({ page }) => {
  // UI mapping test with a fixture response, not an authenticated Storage E2E.
  await installCleanAppState(page);
  const conversationId = '50000000-0000-4000-8000-000000000091';
  const fileId = '51000000-0000-4000-8000-000000000091';
  const path = `/api/conversations/${conversationId}/attachments/${fileId}`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=', 'base64');
  let fileRequests = 0;
  await page.route(`**${path}`, async (route) => {
    fileRequests++;
    await route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
  await page.goto('/chat/mia-hotelier');
  await expect(page.getByTestId('chat-workspace')).toBeVisible();
  await page.evaluate(({ conversationId, fileId }) => {
    const key = 'lingua-chat-parity-v1';
    const state = JSON.parse(localStorage.getItem(key)!);
    const conversation = state.conversations[0];
    conversation.id = conversationId;
    conversation.shareToken = 'private-file-ui-share';
    conversation.visibility = 'unlisted';
    conversation.messages.push({ id: 'restored-file-user', role: 'user', parts: [
      { type: 'text', text: 'My private hotel key' },
      { type: 'file', url: `chat-file://${conversationId}/${fileId}`, mediaType: 'image/png', filename: 'private-key.png' },
    ] });
    state.activeByRoute[conversation.routeKey] = conversationId;
    localStorage.setItem(key, JSON.stringify(state));
  }, { conversationId, fileId });
  await page.goto(`/chat/mia-hotelier?conversation=${conversationId}`);
  await expect(page.getByTestId('chat-workspace')).toHaveAttribute('data-conversation-id', conversationId);
  const image = page.getByRole('img', { name: 'private-key.png', exact: true });
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
  await expect(page.getByRole('link', { name: 'private-key.png 열기' })).toHaveAttribute('href', path);
  await page.reload();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
  const beforeSharing = fileRequests;
  await page.goto('/shared/private-file-ui-share');
  await expect(page.getByTestId('private-attachment-notice')).toContainText('소유자만 열 수 있어요');
  await expect(page.getByRole('img', { name: 'private-key.png' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'private-key.png 열기' })).toHaveCount(0);
  expect(fileRequests).toBe(beforeSharing);
});
