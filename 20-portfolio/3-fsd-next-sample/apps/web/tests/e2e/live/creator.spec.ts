import type { Page } from '@playwright/test';
import { test, expect, adminClient, signIn } from './fixtures';

const origin = 'http://dodonet.iptime.org:13000';
const fixtureImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=';
const unique = () => `E2E ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`;

// API fixture setup does not claim coverage of the mandatory AI image creation UI.
async function seedCharacter(page: Page, publishStatus: 'draft' | 'published' = 'draft') {
  const response = await page.request.post('/api/characters', {
    headers: { Origin: origin },
    data: {
      name: unique(), role: 'Friendly practice partner', tagline: 'Disposable creator test',
      description: 'A private test character for English practice.', personality: ['다정함'],
      personaGoal: 'Help a learner feel welcome.', learningGoal: 'Practice a short greeting.',
      speakingStyle: 'Short and clear English.', relationship: 'Learning partner',
      teachingStyle: 'Give one gentle correction.', prohibitedInstructions: ['Never request personal data.'],
      accent: 'American', level: '입문', topics: ['일상'], palette: ['#ff8067', '#ffc65c'],
      emoji: '🌱', visibility: 'private', publishStatus, imageUrl: fixtureImage,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).item as { id: string; name: string };
}

async function save(page: Page, kind: 'character' | 'mission', id?: string) {
  const path = `/api/${kind === 'character' ? 'characters' : 'missions'}${id ? `/${id}` : ''}`;
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === path
    && ['POST', 'PUT', 'PATCH'].includes(response.request().method()));
  await page.getByTestId(`save-${kind}`).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).item as { id: string };
}

async function databaseResource(table: 'characters' | 'missions', id: string) {
  const { data, error } = await adminClient().from(table)
    .select('id,owner_id,status,current_version_id,visibility').eq('id', id).single();
  expect(error).toBeNull();
  return data!;
}

async function next(page: Page) {
  await page.getByRole('button', { name: '다음 단계', exact: true }).click();
}

async function openCreations(page: Page, kind: 'character' | 'mission', id: string) {
  await page.goto('/profile');
  await page.getByRole('tab', { name: '내 생성물', exact: true }).click();
  return page.getByTestId(`profile-created-${kind}-${id}`);
}

test('CHAR-01/02 new-character validation preserves input and requires explicit image generation', async ({ page }) => {
  await page.goto('/characters/new');
  await next(page);
  await expect(page.getByRole('alert').filter({ hasText: '캐릭터 이름과 역할' })).toBeVisible();
  const name = unique();
  await page.getByTestId('character-name').fill(name);
  await page.getByTestId('character-role').fill('English partner');
  await next(page);
  await next(page);
  await expect(page.getByRole('alert').filter({ hasText: '존재 목적과 학습 목표' })).toBeVisible();
  await page.getByTestId('character-persona-goal').fill('Welcome a learner.');
  await page.getByTestId('character-learning-goal').fill('Practice greetings.');
  await next(page);
  await page.getByTestId('save-character').click();
  await expect(page.getByRole('alert').filter({ hasText: 'AI 이미지 후보를 먼저' })).toBeVisible();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByTestId('character-name')).toHaveValue(name);
});

test('CHAR-06/PROFILE-05 own draft publishes, versions, restricts visibility and archives through UI', async ({ page, playwright, createAccount }) => {
  const character = await seedCharacter(page);
  const initial = await databaseResource('characters', character.id);
  expect(initial.status).toBe('draft');
  const initialImage = await adminClient().from('character_assets').select('storage_path')
    .eq('character_version_id', initial.current_version_id).eq('is_primary', true).single();
  expect(initialImage.error).toBeNull();
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  try {
    expect((await anonymous.get(`/api/characters/${character.id}`)).status()).toBe(404);
    const creation = await openCreations(page, 'character', character.id);
    await expect(creation).toContainText('초안');
    await creation.getByRole('link', { name: '캐릭터 편집하기' }).click();
    await expect(page.getByTestId('character-name')).toHaveValue(character.name);
    await next(page);
    await page.getByRole('button', { name: '게시 상태로 저장', exact: true }).click();
    await next(page);
    await save(page, 'character', character.id);
    await expect.poll(async () => (await databaseResource('characters', character.id)).status).toBe('published');
    expect((await anonymous.get(`/api/characters/${character.id}`)).status()).toBe(404);
    const published = await databaseResource('characters', character.id);
    const oldImage = await adminClient().from('character_assets').select('storage_bucket,storage_path')
      .eq('character_version_id', published.current_version_id).eq('is_primary', true).single();
    expect(oldImage.error).toBeNull();
    expect(oldImage.data?.storage_bucket).toBe('character-private');
    expect(oldImage.data?.storage_path).not.toBe(initialImage.data?.storage_path);
    await page.reload();
    await page.getByTestId('character-name').fill(`${character.name} revised`);
    await next(page);
    await page.getByRole('button', { name: /모두에게 공개/ }).click();
    await next(page);
    const revisionRequest = page.waitForRequest(request => request.method() === 'PATCH'
      && new URL(request.url()).pathname === `/api/characters/${character.id}`);
    await save(page, 'character', character.id);
    const revisionPayload = (await revisionRequest).postDataJSON();
    const revised = await databaseResource('characters', character.id);
    expect(revised.owner_id).toBe(initial.owner_id);
    expect(revised.visibility).toBe('public');
    expect(revised.current_version_id).not.toBe(published.current_version_id);
    const publicImage = await adminClient().from('character_assets').select('storage_bucket,storage_path')
      .eq('character_version_id', revised.current_version_id).eq('is_primary', true).single();
    expect(publicImage.error).toBeNull();
    expect(publicImage.data?.storage_bucket).toBe('character-public');
    expect(publicImage.data?.storage_path).not.toBe(oldImage.data?.storage_path);
    const oldBytes = await adminClient().storage.from('character-private').download(oldImage.data!.storage_path);
    expect(oldBytes.error).toBeNull();
    expect(oldBytes.data?.size).toBeGreaterThan(0);
    const intruder = await playwright.request.newContext({ baseURL: origin });
    try {
      await signIn(intruder, await createAccount());
      const denied = await intruder.patch(`/api/characters/${character.id}`, {
        headers: { Origin: origin }, data: { ...revisionPayload, draft: { ...revisionPayload.draft, visibility: 'private' } },
      });
      expect(denied.status()).toBe(403);
      expect((await denied.json()).error.code).toBe('CHARACTER_NOT_OWNED');
      expect((await databaseResource('characters', character.id)).current_version_id).toBe(revised.current_version_id);
    } finally { await intruder.dispose(); }
    const oldVersion = await adminClient().from('character_versions').select('id').eq('id', published.current_version_id).single();
    expect(oldVersion.error).toBeNull();
    expect((await anonymous.get(`/api/characters/${character.id}`)).ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByTestId('character-name')).toHaveValue(`${character.name} revised`);
    await next(page);
    await page.getByRole('button', { name: '보관하기', exact: true }).click();
    await next(page);
    await save(page, 'character', character.id);
    await expect.poll(async () => (await databaseResource('characters', character.id)).status).toBe('archived');
    expect((await databaseResource('characters', character.id)).current_version_id).toBe(revised.current_version_id);
    const archived = await openCreations(page, 'character', character.id);
    await expect(archived).toContainText('보관');
    await archived.getByRole('link', { name: '보관된 내용 확인' }).click();
    await next(page); await next(page);
    await expect(page.getByTestId('save-character')).toBeDisabled();
  } finally { await anonymous.dispose(); }
});

test('MISSION-01/03/05 manual mission draft persists ordered steps, publishes new versions and archives', async ({ page }) => {
  const character = await seedCharacter(page, 'published');
  await page.goto('/missions/new');
  await next(page);
  await expect(page.getByRole('alert').filter({ hasText: 'AI 초안을 만들거나 미션 제목을 입력해 주세요.' })).toBeVisible();
  const title = unique();
  await page.getByTestId('mission-title').fill(title);
  await page.getByLabel('한 줄 설명', { exact: true }).fill('Practice a friendly greeting.');
  await page.getByLabel('상세 설명', { exact: true }).fill('Say hello and introduce yourself to a practice partner.');
  await page.getByLabel('장소', { exact: true }).fill('Practice cafe');
  await page.getByRole('combobox', { name: /^함께할 캐릭터/ }).selectOption(character.id);
  await next(page);
  await next(page);
  await expect(page.getByRole('alert').filter({ hasText: '학습 목표와 핵심 표현' })).toBeVisible();
  await page.getByRole('button', { name: '목표 추가', exact: true }).click();
  await page.getByLabel('목표 1', { exact: true }).fill('Say hello');
  await page.getByLabel('목표 1 힌트', { exact: true }).fill('Hello!');
  await page.getByRole('button', { name: '단계 추가', exact: true }).click();
  await page.getByLabel('단계 1', { exact: true }).fill('Greeting');
  await page.getByLabel('단계 1 성공 조건', { exact: true }).fill('Greet the partner');
  await page.getByRole('button', { name: '표현 추가', exact: true }).click();
  // The row key includes English text, so use fill rather than typing into a remounting input.
  await page.getByLabel('영어 표현 1', { exact: true }).fill('Hello there.');
  await page.getByLabel('표현 1 뜻', { exact: true }).fill('안녕하세요.');
  await next(page);
  await page.getByLabel('보상 이름', { exact: true }).fill('Greeting keepsake');
  const authoredRequest = page.waitForRequest(request => request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/missions');
  const mission = await save(page, 'mission');
  const authoredDraft = (await authoredRequest).postDataJSON();
  const draft = await databaseResource('missions', mission.id);
  expect(draft.status).toBe('draft');
  // Publishing requires a real stored reward. Seed its bytes via the real API;
  // this fixture is not evidence of the separate AI reward-generation feature.
  const rewardFixture = await page.request.patch(`/api/missions/${mission.id}`, {
    headers: { Origin: origin }, data: { action: 'create-version', expectedVersion: 1,
      draft: { ...authoredDraft, rewardImageUrl: fixtureImage } },
  });
  expect(rewardFixture.ok(), await rewardFixture.text()).toBe(true);
  const creation = await openCreations(page, 'mission', mission.id);
  await expect(creation).toContainText(title);
  await creation.getByRole('link', { name: '미션 편집하기' }).click();
  await expect(page.getByTestId('mission-title')).toHaveValue(title);
  await next(page);
  await expect(page.getByLabel('목표 1', { exact: true })).toHaveValue('Say hello');
  await expect(page.getByLabel('단계 1 성공 조건', { exact: true })).toHaveValue('Greet the partner');
  await next(page);
  await page.getByRole('button', { name: '게시 상태로 저장', exact: true }).click();
  await save(page, 'mission', mission.id);
  const published = await databaseResource('missions', mission.id);
  expect(published.status).toBe('published');
  await page.reload();
  await page.getByTestId('mission-title').fill(`${title} revised`);
  await next(page); await next(page);
  await save(page, 'mission', mission.id);
  const revised = await databaseResource('missions', mission.id);
  expect(revised.owner_id).toBe(draft.owner_id);
  expect(revised.current_version_id).not.toBe(published.current_version_id);
  const oldVersion = await adminClient().from('mission_versions').select('id').eq('id', published.current_version_id).single();
  expect(oldVersion.error).toBeNull();
  await page.reload();
  await expect(page.getByTestId('mission-title')).toHaveValue(`${title} revised`);
  await next(page); await next(page);
  await page.getByRole('button', { name: '보관하기', exact: true }).click();
  await save(page, 'mission', mission.id);
  await expect.poll(async () => (await databaseResource('missions', mission.id)).status).toBe('archived');
  expect((await databaseResource('missions', mission.id)).current_version_id).toBe(revised.current_version_id);
  const archived = await openCreations(page, 'mission', mission.id);
  await expect(archived).toContainText('보관');
  await archived.getByRole('link', { name: '보관된 내용 확인' }).click();
  await next(page); await next(page);
  await expect(page.getByTestId('save-mission')).toBeDisabled();
});
