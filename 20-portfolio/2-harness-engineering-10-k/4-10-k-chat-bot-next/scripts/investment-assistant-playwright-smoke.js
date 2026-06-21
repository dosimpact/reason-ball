#!/usr/bin/env node

const { chromium } = require("playwright");

const BASE_URL = process.env.CHATBOT_BASE_URL || "http://127.0.0.1:3003/";
const CASES = [
  {
    name: "apple-brief",
    prompt:
      "Build an investment brief for Apple using its latest 10-K. Focus on main risks and whether the thesis looks cautious.",
    expectedFiling: {
      companyName: "Apple Inc. 10-K",
      ticker: "AAPL",
      filingDate: "2025-10-31",
    },
    requiredTexts: [
      "Grounded evidence for Apple Inc.",
      "Workspace Snapshot",
      "Collector DB",
      "Collector updated:",
      "Parser:",
      "Freshness:",
      "Investment Frame",
      "Bull Case",
      "Bear Case",
    ],
    forbiddenTexts: [
      "모델 기반 브리프 생성이 실패",
      "fallback 결과를 제공합니다",
      "Apple Hospitality REIT",
      "PATRIOT GOLD CORP",
    ],
  },
  {
    name: "rent-scope",
    prompt:
      "Build an investment brief for Rent the Runway using its latest 10-K. Focus on liquidity risk and whether the thesis looks speculative.",
    expectedFiling: {
      companyName: "Rent the Runway, Inc. 10-K",
      ticker: "RENT",
      filingDate: "2026-04-14",
    },
    requiredTexts: [
      "Workspace Snapshot",
      "Collector DB",
      "Collector updated:",
      "Parser:",
      "Freshness:",
      "Investment Frame",
      "Bull Case",
      "Bear Case",
    ],
    allowedGraphFallback:
      "I could not find grounded evidence in the current filing graph.",
    forbiddenTexts: [
      "모델 기반 브리프 생성이 실패",
      "fallback 결과를 제공합니다",
      "PATRIOT GOLD CORP",
      "Apple Hospitality REIT",
    ],
  },
  {
    name: "chargepoint-liquidity",
    prompt:
      "Build an investment brief for ChargePoint using its latest 10-K. Focus on liquidity risk, debt, and whether the thesis looks speculative.",
    expectedFiling: {
      companyName: "ChargePoint Holdings, Inc. 10-K",
      ticker: "CHPT",
      filingDate: "2026-04-02",
    },
    requiredTexts: [
      "Grounded evidence for ChargePoint Holdings, Inc.",
      "Workspace Snapshot",
      "Collector DB",
      "Collector updated:",
      "Parser:",
      "Freshness:",
      "Investment Frame",
      "Bull Case",
      "Bear Case",
    ],
    forbiddenTexts: [
      "모델 기반 브리프 생성이 실패",
      "fallback 결과를 제공합니다",
      "PATRIOT GOLD CORP",
      "Apple Hospitality REIT",
      "Rent the Runway, Inc. 10-K",
    ],
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNormalizedText(bodyText, expectedText) {
  return normalizeText(bodyText).includes(normalizeText(expectedText));
}

function hasExpectedFiling(bodyText, expectedFiling) {
  const normalizedBody = normalizeText(bodyText);
  const hasCompanyName = normalizedBody.includes(
    normalizeText(expectedFiling.companyName)
  );
  const dateRegex = new RegExp(
    `${escapeRegExp(expectedFiling.ticker)}\\s*·\\s*${escapeRegExp(
      expectedFiling.filingDate
    )}(?:t\\d{2}:\\d{2}:\\d{2}\\.\\d{3}z)?`,
    "i"
  );

  return hasCompanyName && dateRegex.test(bodyText);
}

function isIgnorableConsoleMessage(message) {
  return (
    /\/api\/copilotkit\/agent\/investment-assistant\/connect.*net::ERR_ABORTED/i.test(
      message
    ) ||
    /warning: The resource .*\/_next\/static\/media\/[^ ]+\.woff2(?:\?[^ ]*)? was preloaded using link preload but not used/i.test(
      message
    )
  );
}

async function waitForReadySendButton(page, timeout = 120_000) {
  await page.waitForFunction(
    () =>
      Array.from(
        document.querySelectorAll('[data-testid="copilot-send-button"]')
      ).some((button) => {
        if (!(button instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        const isVisible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
        return (
          isVisible &&
          !button.hasAttribute("disabled") &&
          button.getAttribute("aria-disabled") !== "true"
        );
      }),
    undefined,
    { timeout }
  );

  const buttons = page.locator('[data-testid="copilot-send-button"]:visible');
  const count = await buttons.count();

  for (let index = count - 1; index >= 0; index -= 1) {
    const button = buttons.nth(index);
    const isEnabled = await button.isEnabled().catch(() => false);
    const ariaDisabled = await button.getAttribute("aria-disabled");
    if (isEnabled && ariaDisabled !== "true") {
      return button;
    }
  }

  throw new Error("No visible enabled send button found.");
}

async function fillVisibleTextarea(page, value, timeout = 120_000) {
  await page.waitForFunction(
    () =>
      Array.from(
        document.querySelectorAll('[data-testid="copilot-chat-textarea"]')
      ).some((textarea) => {
        if (!(textarea instanceof HTMLTextAreaElement)) {
          return false;
        }
        const style = window.getComputedStyle(textarea);
        const rect = textarea.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      }),
    undefined,
    { timeout }
  );

  const filled = await page.evaluate((nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    for (const node of document.querySelectorAll(
      '[data-testid="copilot-chat-textarea"]'
    )) {
      if (!(node instanceof HTMLTextAreaElement)) {
        continue;
      }

      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const isVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0;

      if (!isVisible) {
        continue;
      }

      node.scrollIntoView({ block: "center", inline: "nearest" });
      node.focus();

      if (setter) {
        setter.call(node, nextValue);
      } else {
        node.value = nextValue;
      }

      node.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: nextValue,
          inputType: "insertText",
        })
      );
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return false;
  }, value);

  if (!filled) {
    throw new Error("No visible textarea could be filled.");
  }
}

async function runCase(browser, testCase) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1400 },
  });
  const consoleMessages = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleMessages.push(`pageerror: ${err.message}`);
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("Filing-first investment copilot"),
    undefined,
    { timeout: 120_000 }
  );

  await fillVisibleTextarea(page, testCase.prompt);
  const sendButton = await waitForReadySendButton(page);
  await sendButton.click();

  await page.waitForFunction(
    (expectedFiling) => {
      const body = document.body.innerText;
      const normalizedBody = body.replace(/\s+/g, " ").trim().toLowerCase();
      const dateRegex = new RegExp(
        `${expectedFiling.ticker}\\s*·\\s*${expectedFiling.filingDate}(?:t\\d{2}:\\d{2}:\\d{2}\\.\\d{3}z)?`,
        "i"
      );
      return (
        normalizedBody.includes(
          String(expectedFiling.companyName)
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase()
        ) && dateRegex.test(body)
      );
    },
    testCase.expectedFiling,
    { timeout: 120_000 }
  );

  await page.waitForFunction(
    (texts) => {
      const normalizedBody = document.body.innerText
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return texts.every((text) =>
        normalizedBody.includes(
          String(text).replace(/\s+/g, " ").trim().toLowerCase()
        )
      );
    },
    testCase.requiredTexts,
    { timeout: 120_000 }
  );

  if (testCase.allowedGraphFallback) {
    await page.waitForFunction(
      (fallbackText) => {
        const body = document.body.innerText;
        return (
          body.includes("Grounded evidence for") || body.includes(fallbackText)
        );
      },
      testCase.allowedGraphFallback,
      { timeout: 120_000 }
    );
  }

  await page.waitForTimeout(2000);
  const bodyText = await page.locator("body").innerText();

  const screenshotPath = `/tmp/${testCase.name}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();

  return {
    name: testCase.name,
    ok:
      hasExpectedFiling(bodyText, testCase.expectedFiling) &&
      testCase.requiredTexts.every((text) =>
        hasNormalizedText(bodyText, text)
      ) &&
      testCase.forbiddenTexts.every(
        (text) => !hasNormalizedText(bodyText, text)
      ) &&
      consoleMessages.every((message) => isIgnorableConsoleMessage(message)),
    consoleMessages: consoleMessages.filter(
      (message) => !isIgnorableConsoleMessage(message)
    ),
    matchedCompanyText: hasExpectedFiling(bodyText, testCase.expectedFiling)
      ? `${testCase.expectedFiling.companyName} / ${testCase.expectedFiling.ticker} · ${testCase.expectedFiling.filingDate}`
      : null,
    graphState: bodyText.includes("Grounded evidence for")
      ? "grounded"
      : testCase.allowedGraphFallback &&
          bodyText.includes(testCase.allowedGraphFallback)
        ? "explicit-no-evidence"
        : "unknown",
    screenshotPath,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const results = [];

    for (const testCase of CASES) {
      try {
        results.push(await runCase(browser, testCase));
      } catch (error) {
        results.push({
          name: testCase.name,
          ok: false,
          consoleMessages: [],
          matchedCompanyText: null,
          graphState: "unknown",
          screenshotPath: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(JSON.stringify(results, null, 2));

    if (results.some((result) => !result.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
