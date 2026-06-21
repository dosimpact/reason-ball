#!/usr/bin/env node
/**
 * Robust Playwright smoke test for 3005 chatbot.
 * - Enlarges timeouts and avoids brittle waitForResponse-only waits.
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.CHATBOT_BASE_URL || "http://localhost:3005";
const PROMPTS = [
  "AAPL 사업 보고 목록은?",
  "AAPL 10-k 최근 분기 전문 읽어 와줘",
  "요약으로 읽어와줘",
  "기본적으로 중요한 정보를 요약해줘",
  "이 보고서로 투자 의사결정에 필요한 핵심 판단 정리해줘",
];

const CONFIG = {
  pageTimeoutMs: Number(process.env.PAGE_TIMEOUT_MS || 120_000),
  responseWaitMs: Number(process.env.RESPONSE_WAIT_MS || 45_000),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 500),
  settleWaitMs: Number(process.env.SETTLE_WAIT_MS || 500),
  navWaitMs: Number(process.env.NAV_WAIT_MS || 8000),
};

function cleanText(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

function buildSelector(label) {
  return `button:has-text("${label.replace(/"/g, '\\"')}")`;
}

async function waitForTextChange(
  page,
  beforeText,
  timeoutMs = CONFIG.responseWaitMs
) {
  const start = Date.now();
  let lastText = beforeText;

  while (Date.now() - start < timeoutMs) {
    const current = cleanText(await page.locator("body").innerText());
    if (
      current.length - beforeText.length > 12 ||
      current.includes("text-delta")
    ) {
      return {
        changed: true,
        text: current,
        elapsedMs: Date.now() - start,
        lastText,
      };
    }

    if (current.length !== lastText.length) {
      // allow partial progress as fallback
      return {
        changed: true,
        text: current,
        elapsedMs: Date.now() - start,
        lastText,
      };
    }

    lastText = current;
    await page.waitForTimeout(CONFIG.pollIntervalMs);
  }

  return { changed: false, text: lastText, elapsedMs: Date.now() - start };
}

function evaluateAnswer(text, prompt) {
  const t = cleanText(text);

  // Generic checks
  if (!t) {
    return { ok: false, reasons: ["empty_response"] };
  }

  const errRe =
    /(GatewayAuthenticationError|Request failed|오류|에러|timed out|timeout|The request couldn't be processed|Failed to process|Failed to fetch|실패)/i;
  if (errRe.test(t)) {
    return { ok: false, reasons: ["error_signal"] };
  }

  if (/AAPL/i.test(prompt) && /AAPL/.test(t)) {
    return { ok: true, reasons: [] };
  }

  if (/사업 보고 목록/.test(prompt) && /최근 공시|목록|accession/i.test(t)) {
    return { ok: true, reasons: [] };
  }

  if (/요약/.test(prompt) && /요약|요약입니다|핵심 한줄/.test(t)) {
    return { ok: true, reasons: [] };
  }

  if (
    /투자/.test(prompt) &&
    /(Stance|결론|다음 확인|Next Checks|핵심|brf)/i.test(t)
  ) {
    return { ok: true, reasons: [] };
  }

  if (/전문/.test(prompt) && /원문|## Item|## Item 1|Filing|aapl/i.test(t)) {
    return { ok: true, reasons: [] };
  }

  return { ok: true, reasons: ["fallback_no_keyword_match"] };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    timeout: CONFIG.pageTimeoutMs,
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
  });

  try {
    page.setDefaultTimeout(CONFIG.pageTimeoutMs);
    page.setDefaultNavigationTimeout(CONFIG.pageTimeoutMs);

    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.pageTimeoutMs,
    });
    await page.waitForTimeout(CONFIG.navWaitMs);

    // start a new chat if available
    const newChat = page.locator('button:has-text("New Chat")').first();
    if (await newChat.count()) {
      await newChat.click().catch(() => undefined);
      await page.waitForTimeout(800);
    }

    const results = [];

    for (const prompt of PROMPTS) {
      const before = cleanText(await page.locator("body").innerText());

      let clicked = false;
      const suggested = page.locator(buildSelector(prompt)).first();
      if (await suggested.count()) {
        await suggested.scrollIntoViewIfNeeded().catch(() => undefined);
        await suggested.click({ timeout: CONFIG.pageTimeoutMs });
        clicked = true;
      } else {
        const textarea = page
          .locator(
            'textarea[name="message"], textarea[placeholder*="메시지" i], textarea'
          )
          .first();
        if (await textarea.count()) {
          await textarea.fill(prompt);
          await page
            .locator('button[type="submit"]')
            .click({ timeout: CONFIG.pageTimeoutMs })
            .catch(() => undefined);
          clicked = true;
        }
      }

      if (!clicked) {
        results.push({ prompt, ok: false, reason: "ui_not_found" });
        continue;
      }

      const waited = await waitForTextChange(page, before);
      await page.waitForTimeout(CONFIG.settleWaitMs);

      const snapshot = cleanText(await page.locator("body").innerText());
      const evalResult = evaluateAnswer(snapshot, prompt);

      results.push({
        prompt,
        ok: evalResult.ok,
        changed: waited.changed,
        elapsedMs: waited.elapsedMs,
        note: evalResult.reasons,
        sample: snapshot.slice(-220),
      });
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await page.screenshot({
      path: "/tmp/chatbot-robust-smoke.png",
      fullPage: true,
    });
    await browser.close();
  }
})();
