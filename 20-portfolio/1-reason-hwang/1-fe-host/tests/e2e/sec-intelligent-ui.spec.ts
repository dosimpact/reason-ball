import { test, expect } from '@playwright/test';

// SEC-IUI-003: real SEC refresh + real provider + actual chat controls; opt-in.
const companies = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'WMT', 'XOM'];
const requiredItems = [['1'], ['1'], ['1A'], ['3'], ['7'], ['8'], ['1', '1A', '3', '7', '8']];

test.describe.configure({ mode: 'parallel' });
for (const ticker of companies) {
  test(`${ticker}: latest 10-K and all seven valuation questions`, async ({ page }, testInfo) => {
    test.skip(!process.env.SEC_LIVE_BASE_URL, 'Requires an explicitly owned live stack and provider.');
    test.setTimeout(1_200_000);
    const consoleErrors: string[] = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    // Clone the real fetch stream for evidence; CDP may evict long SSE bodies.
    await page.addInitScript(() => {
      const host = window as typeof window & { secChatStreams: { done: boolean; body: string; status: number }[] };
      host.secChatStreams = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (response.url.endsWith('/api/sec-chat/chat')) {
          const record = { done: false, body: '', status: response.status };
          host.secChatStreams.push(record);
          void response.clone().text().then(body => { record.body = body; record.done = true; }, () => { record.done = true; });
        }
        return response;
      };
    });
    await page.goto('/sec-chat');
    const preparedResponse = page.waitForResponse(r => r.url().endsWith('/api/sec-chat/prepare'), { timeout: 900_000 });
    await page.getByRole('textbox', { name: '메시지', exact: true }).fill(`${ticker} 사업 개요를 간단히 알려줘`);
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
    const response = await preparedResponse;
    const prepared = await response.json();
    expect(response.status(), JSON.stringify(prepared)).toBe(200);
    expect(prepared.checkedAt).toBeTruthy();
    expect(prepared.filing.formType).toBe('10-K');
    expect(prepared.missingItems).toEqual([]);
    await testInfo.attach('latest-filing', { body: JSON.stringify(prepared, null, 2), contentType: 'application/json' });
    await expect(page.getByTestId('intelligent-ui-answer')).toHaveCount(1, { timeout: 360_000 });
    const questions = [
      "Item 1 Business의 소제목을 원문에서 추출해줘.",
      "방금 추출한 소제목별로 요약해줘. 주요 제품/서비스, 고객, 공급망 관계를 정리해줘.",
      "Item 1A Risk Factors의 사업과 실적 위험을 정리해줘.",
      "Item 3 Legal Proceedings의 중요한 법적 분쟁과 규제 내용을 정리해줘.",
      "Item 7 MD&A의 사업 실적, 다음 회계연도 목표, 경영 방침, 리스크와 불확실성을 정리해줘.",
      "Item 8 재무제표와 주석에서 가치평가에 필요한 수치, 기간, 단위를 정리해줘.",
      "기업 가치평가 기반 자료를 추출해줘. Item 1, 1A, 3, 7, 8을 각각 정리하고 원문 근거와 한계를 보여줘.",
    ];
    try {
      for (let index = 0; index < 7; index++) {
        const answerResponse = page.waitForResponse(r => r.url().endsWith('/api/sec-chat/chat'), { timeout: 360_000 });
        await page.getByRole('textbox', { name: '메시지', exact: true }).fill(questions[index]);
        await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
        const stream = await answerResponse;
        expect(stream.status()).toBe(200);
        await page.waitForFunction(index => (window as typeof window & { secChatStreams: { done: boolean }[] }).secChatStreams[index + 1]?.done, index, { timeout: 360_000 });
        const sse = await page.evaluate(index => (window as typeof window & { secChatStreams: { body: string }[] }).secChatStreams[index + 1].body, index);
        await testInfo.attach(`question-${index + 1}-agui`, { body: sse, contentType: 'text/plain' });
        expect(sse).toContain('RUN_FINISHED');
        expect(sse).not.toContain('RUN_ERROR');
        const program = sse.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
          .filter(event => event.type === 'TEXT_MESSAGE_CONTENT').map(event => event.delta).join('');
        const events = sse.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
        const evidence = events.find(event => event.name === 'sec.evidence').value;
        expect(evidence.findings.length).toBeGreaterThan(0);
        for (const item of requiredItems[index]) expect(evidence.findings.some((row: {item: string}) => row.item === item)).toBe(true);
        if (index === 5) {
          // A pointer to another page is not a financial-statement answer.
          const financialSummary = program;
          expect(financialSummary).toMatch(/20\d{2}/);
          expect(financialSummary).toMatch(/\d[\d,.]*\s*(?:백만|십억|억|조|million|billion|달러|dollars|USD)/i);
          expect(financialSummary).toMatch(/매출|수익|순이익|자산|현금흐름/);
        }
        await expect(page.getByTestId('intelligent-ui-answer')).toHaveCount(index + 2, { timeout: 30_000 });
        const answer = page.getByTestId('intelligent-ui-answer').last();
        await expect(answer.getByRole('link', { name: 'SEC 원문 공시' })).toHaveAttribute('href', prepared.sourceUrl);
        await expect(answer).toContainText(prepared.filing.accessionNo);
        for (const item of requiredItems[index]) await expect(answer.locator('.iui-badge').filter({ hasText: new RegExp(`^Item ${item} ·`) }).first()).toBeVisible();
        const text = await answer.innerText();
        expect(text.length).toBeGreaterThan(400);
        await testInfo.attach(`question-${index + 1}-visible`, { body: text, contentType: 'text/plain' });
        const checkbox = answer.getByRole('checkbox', { name: '원문 인용 표시', exact: true });
        await expect(checkbox).toBeChecked();
        await checkbox.uncheck();
        await expect(checkbox).not.toBeChecked();
        expect((await answer.innerText()).length).toBeLessThan(text.length);
        await checkbox.check();
        await expect(page.locator(".sec-error")).toHaveCount(0);
        if (index === 5 || index === 6) await testInfo.attach(`question-${index + 1}-render`, { body: await answer.screenshot(), contentType: 'image/png' });
      }
      expect(consoleErrors).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
    } finally {
      await page.request.delete(`/api/sec-chat/threads/${prepared.threadId}`);
    }
  });
}
