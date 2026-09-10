import { expect, test } from '@playwright/test';
import type { MissionRun } from '../../src/entities/mission-run/model/types';
import { installCleanAppState } from './test-setup';

test('creates separate active attempts for separate chats and restores the original attempt', async ({ page }) => {
  await installCleanAppState(page);
  const runs = async (): Promise<MissionRun[]> => (await (await page.request.get('/api/mission-runs')).json()).runs;
  await page.goto('/missions/hotel-check-in');
  await page.getByTestId('start-mission').click();
  await expect(page).toHaveURL(/conversation=/);
  await expect(page.getByTestId('mission-evaluation-panel')).toBeVisible();
  const firstUrl = page.url();
  const firstConversation = await page.getByTestId('chat-workspace').getAttribute('data-conversation-id');
  await expect.poll(async () => (await runs()).length).toBe(1);
  const firstRun = (await runs())[0];
  expect(firstRun.conversationId).toBe(firstConversation);
  await page.getByTestId('chat-input').fill('Hello, this is my first attempt.');
  await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
  await expect(page.getByTestId('message-user')).toContainText('this is my first attempt');
  await expect(page.getByText('● 대화 가능', { exact: false })).toBeVisible();

  // Starting again before completing the first attempt must not steal its run.
  await page.goto('/missions/hotel-check-in');
  await page.getByTestId('start-mission').click();
  await expect(page).toHaveURL((url) => Boolean(url.searchParams.get('conversation')) && url.href !== firstUrl);
  await expect(page.getByTestId('mission-evaluation-panel')).toBeVisible();
  const secondConversation = await page.getByTestId('chat-workspace').getAttribute('data-conversation-id');
  expect(secondConversation).not.toBe(firstConversation);
  await expect.poll(async () => (await runs()).length).toBe(2);
  const secondRun = (await runs()).find((run) => run.conversationId === secondConversation);
  expect(secondRun?.id).toBeTruthy();
  expect(secondRun?.id).not.toBe(firstRun.id);
  expect(secondRun?.attemptNumber).toBe(2);
  await expect(page.getByTestId('message-user')).toHaveCount(0);

  await page.goto(firstUrl);
  await expect(page.getByTestId('message-user')).toContainText('this is my first attempt');
  await expect(page.getByTestId('mission-evaluation-panel')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('message-user')).toContainText('this is my first attempt');
  await expect(page.getByTestId('mission-evaluation-panel')).toBeVisible();
  const restored = await runs();
  expect(restored).toHaveLength(2);
  expect(restored.find((run) => run.conversationId === firstConversation)?.id).toBe(firstRun.id);
});
