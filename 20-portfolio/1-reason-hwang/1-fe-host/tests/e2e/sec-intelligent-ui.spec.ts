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
    await page.getByRole('textbox', { name: '기업명 또는 티커', exact: true }).fill(ticker);
    await page.getByRole('button', { name: '기업 검색', exact: true }).click();
    const companyRow = page.locator('.sec-companies li').filter({ has: page.locator('strong', { hasText: new RegExp(`^${ticker}$`) }) });
    await expect(companyRow).toHaveCount(1);
    const preparedResponse = page.waitForResponse(r => r.url().endsWith('/api/sec-chat/prepare'), { timeout: 900_000 });
    await companyRow.getByRole('button', { name: '최신 10-K 다운로드', exact: true }).click();
    const response = await preparedResponse;
    const prepared = await response.json();
    expect(response.status(), JSON.stringify(prepared)).toBe(200);
    expect(prepared.checkedAt).toBeTruthy();
    expect(prepared.filing.formType).toBe('10-K');
    expect(prepared.missingItems).toEqual([]);
    await testInfo.attach('latest-filing', { body: JSON.stringify(prepared, null, 2), contentType: 'application/json' });
    await expect(page.locator('.sec-selected')).toContainText(ticker);
    const questions = await page.locator('.sec-prompts button').allTextContents();
    expect(questions).toHaveLength(7);
    try {
      for (let index = 0; index < 7; index++) {
        if ((await page.locator('.sec-prompts').getAttribute('open')) === null) await page.locator('.sec-prompts summary').click();
        const answerResponse = page.waitForResponse(r => r.url().endsWith('/api/sec-chat/chat'), { timeout: 360_000 });
        await page.getByRole('button', { name: questions[index], exact: true }).click();
        const stream = await answerResponse;
        expect(stream.status()).toBe(200);
        await page.waitForFunction(index => (window as typeof window & { secChatStreams: { done: boolean }[] }).secChatStreams[index]?.done, index, { timeout: 360_000 });
        const sse = await page.evaluate(index => (window as typeof window & { secChatStreams: { body: string }[] }).secChatStreams[index].body, index);
        await testInfo.attach(`question-${index + 1}-agui`, { body: sse, contentType: 'text/plain' });
        expect(sse).toContain('RUN_FINISHED');
        expect(sse).not.toContain('RUN_ERROR');
        const program = sse.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
          .filter(event => event.type === 'TEXT_MESSAGE_CONTENT').map(event => event.delta).join('');
        const rowsLine = program.split('\n').find(line => line.startsWith('rows = '));
        expect(rowsLine).toBeTruthy();
        const rows = JSON.parse(rowsLine!.slice(7)) as { item: string; heading: string; summary: string }[];
        if (index === 5) {
          // A pointer to another page is not a financial-statement answer.
          const financialSummary = rows.map(row => row.summary).join('\n');
          expect(financialSummary).toMatch(/20\d{2}/);
          expect(financialSummary).toMatch(/\d[\d,.]*\s*(?:백만|십억|억|조|million|billion|달러|dollars|USD)/i);
          expect(financialSummary).toMatch(/매출|수익|순이익|자산|현금흐름/);
        }
        await expect(page.getByTestId('intelligent-ui-answer')).toHaveCount(index + 1, { timeout: 30_000 });
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
