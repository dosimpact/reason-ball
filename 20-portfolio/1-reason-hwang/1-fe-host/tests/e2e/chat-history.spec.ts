import { test, expect } from '@playwright/test';

test('Chat history restores a thread, continues it, and records new thread metadata', async ({ page }) => {
  let continuedThread = '';
  let createdMetadata: Record<string, unknown> | undefined;
  const saved = { thread_id: 'saved-chat', created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z', status: 'idle', metadata: { source: 'host-chat', graph_id: 'starter_graph', title: '저장된 대화 검증' } };
  const messages = [{ id: 'u1', type: 'human', content: '이전 질문' }, { id: 'a1', type: 'ai', content: '이전 답변 복원' }];
  await page.route('**/api/langgraph/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/langgraph', '');
    if (path === '/threads/search') {
      const graph = route.request().postDataJSON().metadata.graph_id;
      return route.fulfill({ json: graph === 'starter_graph' ? [saved] : [] });
    }
    if (path === '/threads/saved-chat/state') return route.fulfill({ json: { values: { messages } } });
    if (path === '/threads') {
      createdMetadata = route.request().postDataJSON().metadata;
      return route.fulfill({ json: { ...saved, thread_id: 'new-chat', metadata: createdMetadata } });
    }
    if (path.endsWith('/runs/stream')) {
      continuedThread = path.split('/')[2];
      const input = route.request().postDataJSON().input.messages;
      return route.fulfill({ contentType: 'text/event-stream', body: `event: values\ndata: ${JSON.stringify({ messages: [...messages, ...input, { id: 'a2', type: 'ai', content: '후속 답변 검증' }] })}\n\n` });
    }
    return route.fulfill({ status: 404, json: { detail: 'Unexpected test request' } });
  });
  await page.goto('/langgraph-dev-chat');
  await page.getByText('History · 대화 기록', { exact: true }).click();
  await page.getByRole('button', { name: /저장된 대화 검증/ }).click();
  await expect(page.getByText('이전 답변 복원', { exact: true })).toBeVisible();
  await page.locator('textarea[placeholder="메시지를 입력하세요"]').fill('후속 질문');
  await page.locator('textarea[placeholder="메시지를 입력하세요"]').press('Enter');
  await expect(page.getByText('후속 답변 검증', { exact: true })).toBeVisible();
  expect(continuedThread).toBe('saved-chat');
  expect(createdMetadata).toBeUndefined();
  await page.getByRole('button', { name: '새 대화', exact: true }).click();
  await expect(page.getByText('이전 답변 복원', { exact: true })).toHaveCount(0);
  await page.locator('textarea:visible').fill('새 제목');
  await page.locator('textarea:visible').press('Enter');
  await expect.poll(() => createdMetadata).toEqual({ source: 'host-chat', graph_id: 'starter_graph', title: '새 제목' });
});
