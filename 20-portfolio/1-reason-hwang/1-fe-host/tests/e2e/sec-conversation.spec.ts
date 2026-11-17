import { test, expect } from '@playwright/test';

// SEC-IUI-004: deterministic UI boundary coverage; real provider covered separately.
const apple = { cik: '0000320193', ticker: 'AAPL', name: 'Apple Inc.' };
const prepared = { threadId: 'a'.repeat(32), filing: { accessionNo: 'fixture-filing', filingDate: '2025-10-31' }, checkedAt: 'fixture', missingItems: [] };

// Failure-path tests stay deterministic; actual failure-model integration is verified with MCP.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/sec-chat/failure-reply', route => route.fulfill({ json: { reply: '요청을 완료하지 못했어요. 다시 시도해 주세요.', source: 'fallback' } }));
});

for (const stage of ['resolve', 'prepare', 'chat', 'collect'] as const) {
  test(`failure reply: ${stage} gets an assistant answer and keeps failure activity`, async ({ page }) => {
    let recoveryBody: Record<string, unknown> | undefined;
    let chatCalls = 0;
    const question = '애플 실패 흐름을 확인해줘';
    const reply = `${stage} 작업을 완료하지 못했습니다. 질문을 다시 보내 주세요.`;
    const failure = (message: string) => [{ type: 'CUSTOM', name: 'sec.activity', value: { id: 'failed-node', label: '실패한 작업', kind: 'node', status: 'failed' } }, { type: 'RUN_ERROR', message }].map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
    await page.route('**/api/sec-chat/resolve', route => stage === 'resolve'
      ? route.fulfill({ status: 502, json: { detail: '일시적인 연결 오류' } })
      : route.fulfill({ json: stage === 'collect' ? { action: 'collect', company: apple, years: 2 } : { action: 'research', company: apple, question, refresh: false } }));
    await page.route('**/api/sec-chat/prepare', route => stage === 'prepare'
      ? route.fulfill({ contentType: 'text/event-stream', body: failure('최신 10-K 원문 다운로드가 완료되지 않았습니다.') })
      : route.fulfill({ json: prepared }));
    await page.route('**/api/sec-chat/chat', route => { chatCalls++; return route.fulfill({ contentType: 'text/event-stream', body: failure('Intelligent UI 답변 형식 검증에 실패했습니다.') }); });
    await page.route('**/api/sec-chat/collect', route => route.fulfill({ contentType: 'text/event-stream', body: failure('공시 수집에 실패했습니다.') }));
    await page.route('**/api/sec-chat/failure-reply', route => {
      recoveryBody = route.request().postDataJSON();
      return route.fulfill({ json: { reply, source: 'model' } });
    });
    await page.goto('/sec-chat');
    await page.getByRole('textbox', { name: '메시지를 입력하세요' }).fill(question);
    await page.getByRole('textbox', { name: '메시지를 입력하세요' }).press('Enter');
    await expect(page.getByTestId('intelligent-ui-answer').last()).toContainText(reply);
    expect(recoveryBody).toEqual({ message: question, stage, reason: ({ resolve: 'connection_failed', prepare: 'filing_not_ready', chat: 'invalid_response', collect: 'unknown' })[stage], ...(stage === 'resolve' ? {} : { company: apple }) });
    expect(chatCalls).toEqual(stage === 'chat' ? 1 : 0);
    const timeline = page.locator('.sec-timeline').last();
    await expect(timeline).toContainText('일부 작업 실패');
    expect(await timeline.locator('li[data-status="failed"]').count()).toBeGreaterThan(0);
    await expect(timeline.locator('li[data-status="completed"]').filter({ hasText: '실패 상황 답변 생성' })).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: '검증된 원문 근거' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '다음 추천 질문' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sec-chat-history-v1'))).toContain(reply);
  });
}

test('failure reply: unavailable recovery still shows a nonempty assistant answer', async ({ page }) => {
  let recoveryCalls = 0;
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ status: 502, json: { detail: '연결 오류' } }));
  await page.route('**/api/sec-chat/failure-reply', route => { recoveryCalls++; return route.fulfill({ status: 502 }); });
  await page.goto('/sec-chat');
  await page.getByRole('textbox', { name: '메시지를 입력하세요' }).fill('실패 테스트');
  await page.getByRole('textbox', { name: '메시지를 입력하세요' }).press('Enter');
  await expect(page.getByTestId('intelligent-ui-answer').last()).toContainText('요청을 해석하는 중 문제가 생겨');
  await expect(page.locator('.sec-timeline').last().locator('li[data-status="unavailable"]').filter({ hasText: '실패 상황 답변 생성' })).toHaveCount(1);
  expect(recoveryCalls).toEqual(1);
});

test('failure reply: cancellation during recovery suppresses late model output', async ({ page }) => {
  let release!: () => void;
  let recoveryCalls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ status: 502, json: { detail: '연결 오류' } }));
  await page.route('**/api/sec-chat/failure-reply', async route => {
    recoveryCalls++; await gate;
    await route.fulfill({ json: { reply: '취소 뒤 늦게 도착한 설명', source: 'model' } }).catch(() => undefined);
  });
  try {
    await page.goto('/sec-chat');
    await page.getByRole('textbox', { name: '메시지를 입력하세요' }).fill('실패 테스트');
    await page.getByRole('textbox', { name: '메시지를 입력하세요' }).press('Enter');
    await expect.poll(() => recoveryCalls).toEqual(1);
    await page.getByRole('button', { name: /^(Cancel|Cancel message)$/ }).click();
    await expect(page.getByTestId('intelligent-ui-answer').last()).toContainText('답변 생성을 중단했어요');
    await expect(page.locator('.sec-timeline').last().locator('li[data-status="cancelled"]').filter({ hasText: '실패 상황 답변 생성' })).toHaveCount(1);
    release();
    await expect(page.getByText('취소 뒤 늦게 도착한 설명', { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test('conversation: starts with a composer, handles ordinary replies and resets', async ({ page }) => {
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: '안녕하세요. 편하게 질문해 주세요.', followUps: ['10-K를 설명해줘', '애플의 사업은?', '위험요인을 읽는 법은?'] } }));
  await page.goto('/sec-chat');
  await expect(page.locator('textarea:visible').first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: '기업명 또는 티커' })).toHaveCount(0);
  await page.locator('textarea:visible').first().fill('안녕');
  await page.locator('textarea:visible').first().press('Enter');
  await expect(page.getByText('안녕하세요. 편하게 질문해 주세요.', { exact: true })).toBeVisible();
  const followUps = page.getByRole('navigation', { name: '다음 추천 질문' });
  await expect(followUps.getByRole('button')).toHaveCount(3);
  await followUps.getByRole('button', { name: '10-K를 설명해줘', exact: true }).click();
  await expect(page.locator('.openui-agent-thread-message-user').last()).toHaveText('10-K를 설명해줘');
  await expect(page.getByTestId('intelligent-ui-answer')).toHaveCount(2);
  await expect(followUps.first().getByRole('button').first()).toBeDisabled();
  await page.getByRole('button', { name: '새 대화', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: '무엇이 궁금하세요?' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('conversation: working timeline stays inside the pending assistant turn', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sec-chat/resolve', async route => {
    await waiting;
    await route.fulfill({ json: { action: 'reply', reply: '완료했습니다.' } });
  });
  await page.goto('/sec-chat');
  try {
    await page.locator('textarea:visible').first().fill('질문');
    await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
    const timeline = page.locator('.sec-timeline');
    await expect(timeline).toBeVisible();
    await expect(timeline).toContainText('Working');
    await expect(page.locator('.agent-conversation__status .sec-timeline')).toHaveCount(0);
    await expect(page.locator('.agent-conversation__answer .sec-timeline')).toHaveCount(1);
  } finally { release(); }
  await expect(page.getByText('완료했습니다.', { exact: true })).toBeVisible();
  await expect(page.locator('.agent-conversation__answer .sec-timeline')).toHaveCount(1);
});

test('conversation: company clarification preserves the original question', async ({ page }) => {
  let chatBody: Record<string, unknown> = {};
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'choose', reply: '어느 기업을 말씀하셨나요?', companies: [apple], question: '애플의 사업 구조를 요약해줘', refresh: false } }));
  await page.route('**/api/sec-chat/prepare', async route => {
    expect(route.request().postDataJSON()).toEqual({ cik: apple.cik, refresh: false });
    await route.fulfill({ json: prepared });
  });
  await page.route('**/api/sec-chat/chat', async route => {
    chatBody = route.request().postDataJSON();
    const events = [{ type: 'TEXT_MESSAGE_CONTENT', delta: 'root = Text("공시 기반 테스트 답변")' }, { type: 'CUSTOM', name: 'sec.follow-ups', value: { questions: ['매출 비중은?', '주요 위험은?', '현금흐름은?'], status: 'ready' } }, { type: 'RUN_FINISHED' }];
    await route.fulfill({ contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') });
  });
  await page.goto('/sec-chat');
  await page.locator('textarea:visible').first().fill('애플의 사업 구조를 요약해줘');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
  await page.getByRole('button', { name: 'AAPL Apple Inc.' }).click();
  await expect(page.getByTestId('intelligent-ui-answer').last()).toContainText('공시 기반 테스트 답변');
  await expect(page.getByRole('navigation', { name: '다음 추천 질문' }).getByRole('button')).toHaveCount(3);
  expect(chatBody).toEqual({ threadId: prepared.threadId, message: '애플의 사업 구조를 요약해줘' });
});

test('conversation: failure keeps submitted history and explicit retry succeeds', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/sec-chat/resolve', route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 502, json: { detail: '일시적인 연결 오류' } }) : route.fulfill({ json: { action: 'reply', reply: '다시 연결됐어요.' } });
  });
  await page.goto('/sec-chat');
  await page.locator('textarea:visible').first().fill('안녕');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
  await expect(page.locator('[data-slot="agent-chat-frame"]').getByRole('alert').filter({ hasText: '일시적인 연결 오류' })).toBeVisible();
  await expect(page.locator('textarea:visible').first()).toHaveValue('');
  await expect(page.locator('.openui-agent-thread-message-user').last()).toHaveText('안녕');
  await page.locator('textarea:visible').first().fill('안녕');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
  await expect(page.getByText('다시 연결됐어요.', { exact: true })).toBeVisible();
});

test('conversation: cancel preserves submitted history without a successful answer', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sec-chat/resolve', async route => {
    await gate;
    await route.fulfill({ json: { action: 'reply', reply: '취소 후 표시하면 안 되는 답변' } }).catch(() => undefined);
  });
  try {
    await page.goto('/sec-chat');
    await page.locator('textarea:visible').first().fill('애플 분석해줘');
    await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
    await page.getByRole('button', { name: /^(Cancel|Cancel message)$/ }).click();
    await expect(page.locator('[data-slot="agent-chat-frame"]').getByRole('alert')).toContainText('중단했어요');
    await expect(page.locator('.sec-timeline').last()).toContainText('중단됨');
    await expect(page.locator('textarea:visible').first()).toHaveValue('');
    await expect(page.locator('.openui-agent-thread-message-user').last()).toHaveText('애플 분석해줘');
    await expect(page.getByText('취소 후 표시하면 안 되는 답변', { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test('conversation: live timeline collapses after completion and preserves failure status', async ({ page }) => {
  const activity = (status: string) => ({ type: 'CUSTOM', name: 'sec.activity', value: { id: 'step-1', label: '메시지 해석', status, kind: 'node' } });
  let attempts = 0;
  await page.route('**/api/sec-chat/resolve', route => {
    attempts++;
    const events = attempts === 1
      ? [activity('running'), activity('completed'), { type: 'CUSTOM', name: 'sec.resolution', value: { action: 'reply', reply: '분석 준비가 됐어요.' } }, { type: 'RUN_FINISHED' }]
      : [activity('running'), activity('failed'), { type: 'RUN_ERROR', message: '작업에 실패했어요.' }];
    return route.fulfill({ contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') });
  });
  await page.goto('/sec-chat');
  await page.locator('textarea:visible').first().fill('안녕');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
  await expect(page.getByText('분석 준비가 됐어요.', { exact: true })).toBeVisible();
  const first = page.locator('.sec-timeline').first();
  await expect(first).not.toHaveAttribute('open', '');
  await first.locator('summary').click();
  await expect(first.locator('.sec-activity-label').filter({ hasText: '메시지 해석' })).toBeVisible();
  await expect(first.locator('li[data-status="completed"]')).toHaveCount(2);
  await page.locator('textarea:visible').first().fill('다음 질문');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
  await expect(page.locator('[data-slot="agent-chat-frame"]').getByRole('alert')).toContainText('작업에 실패했어요.');
  const last = page.locator('.sec-timeline').last();
  await expect(last).toContainText('일부 작업 실패');
  await last.locator('summary').click();
  await expect(last.locator('li[data-status="failed"]')).toHaveCount(2);
  await expect(first.locator('li[data-status="completed"]')).toHaveCount(2);
});

test('conversation: legacy prose reply uses OpenUI markdown', async ({ page }) => {
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: '### 일회성 수익 찾기\n\n- **매각이익**을 확인하세요.', followUps: [] } }));
  await page.goto('/sec-chat');
  await page.locator('textarea:visible').first().fill('재무제표 주석 읽는 법');
  await page.locator('textarea:visible').first().press('Enter');
  await expect(page.getByRole('heading', { name: '일회성 수익 찾기' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '매각이익' })).toBeVisible();
  await expect(page.getByTestId('intelligent-ui-answer').locator('strong')).toHaveText('매각이익');
});


test('conversation: explicit refresh is forwarded when requested', async ({ page }) => {
  let refresh: boolean | undefined;
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'research', company: apple, question: '최신 공시로 다시 확인', refresh: true } }));
  await page.route('**/api/sec-chat/prepare', async route => {
    refresh = route.request().postDataJSON().refresh;
    await route.fulfill({ status: 409, json: { detail: '수집 요청 확인용 종료' } });
  });
  await page.goto('/sec-chat');
  await page.locator('textarea:visible').first().fill('애플 최신 공시로 다시 수집해서 확인해줘');
  await page.getByRole('button', { name: /^(Send|Send message)$/ }).click();
  await expect.poll(() => refresh).toBe(true);
  await expect(page.getByText('수집 요청 확인용 종료', { exact: true })).toBeVisible();
});

test('SEC conversation history survives reload and restores a selected conversation', async ({ page }) => {
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: '저장할 답변입니다.' } }));
  await page.goto('/sec-chat');
  await page.evaluate(() => localStorage.removeItem('sec-chat-history-v1'));
  await page.reload();
  await page.locator('textarea:visible').first().fill('저장할 질문');
  await page.locator('textarea:visible').first().press('Enter');
  await expect(page.getByText('저장할 답변입니다.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sec-chat-history-v1'))).toContain('저장할 질문');
  await page.reload();
  await page.locator('summary:visible').filter({ hasText: '대화 기록' }).click();
  await page.getByRole('button', { name: /저장할 질문/ }).click();
  await expect(page.getByText('저장할 답변입니다.', { exact: true })).toBeVisible();
});

// SEC-COLLECT-CHAT-001: collection must not fall through to 10-K preparation.
test('conversation: selected company collection preserves scope and exposes failure', async ({ page }) => {
  let collectBody: Record<string, unknown> = {};
  let failed = false;
  let preparedCalls = 0;
  await page.route('**/api/sec-chat/prepare', route => { preparedCalls++; return route.fulfill({ status: 500 }); });
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: {
    action: 'choose', reply: '수집할 기업을 선택해 주세요.', companies: [apple], question: '최근 1년 공시 수집', refresh: false,
    pendingAction: 'collect', years: 1, since: '2026-01-01',
  } }));
  await page.route('**/api/sec-chat/collect', async route => {
    collectBody = route.request().postDataJSON();
    await route.fulfill(failed ? { status: 502, json: { detail: '공시 수집 실패' } } : { json: { reply: '공시 수집 완료: 원문 3건, 실패 0건.' } });
  });
  await page.goto('/sec-chat');
  const input = page.getByRole('textbox', { name: '메시지를 입력하세요' });
  await input.fill('애플의 최근 1년 공시를 수집해 줘');
  await input.press('Enter');
  await page.getByRole('button', { name: 'AAPL Apple Inc.', exact: true }).click();
  await expect(page.getByText('공시 수집 완료: 원문 3건, 실패 0건.', { exact: true })).toBeVisible();
  expect(collectBody).toEqual({ cik: apple.cik, years: 1, since: '2026-01-01' });
  expect(preparedCalls).toBe(0);
  failed = true;
  await input.fill('다시 공시를 수집해 줘');
  await input.press('Enter');
  await page.getByRole('button', { name: 'AAPL Apple Inc.', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '공시 수집 실패' })).toBeVisible();
  await expect(page.getByText('공시 수집 완료: 원문 3건, 실패 0건.', { exact: true })).toHaveCount(1);
  expect(preparedCalls).toBe(0);
});
