import { expect, type Page, test } from "@playwright/test";

const BASE_URL =
  process.env.CHATBOT_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "/";

const SCENARIOS = [
  {
    name: "apple-inline-panels",
    prompt:
      "Build an investment brief for Apple using its latest 10-K. Focus on main risks and whether the thesis looks cautious.",
    expectedFiling: {
      companyName: "Apple Inc. 10-K",
      ticker: "AAPL",
      filingDate: "2025-10-31",
    },
    requiredTexts: [
      "Workspace Snapshot",
      "Selected Filing",
      "Collector DB",
      "Collector updated:",
      "Parser:",
      "Freshness:",
      "Data Readiness",
      "Filing catalog",
      "Local filing text",
      "Parser graph",
      "Decision Quality",
      "Evidence, freshness, and runtime checks",
      "Brief evidence",
      "Graph evidence",
      "Runtime reliability",
      "Graph Evidence",
      "A2UI Dashboard",
      "Grounded evidence for Apple Inc.",
      "Investment Frame",
      "Bull Case",
      "Bear Case",
      "Unknowns",
    ],
    forbiddenTexts: [
      "Apple Hospitality REIT",
      "PATRIOT GOLD CORP",
      "모델 기반 브리프 생성이 실패",
    ],
  },
  {
    name: "rent-inline-panels",
    prompt:
      "Build an investment brief for Rent the Runway using its latest 10-K. Focus on liquidity risk and whether the thesis looks speculative.",
    expectedFiling: {
      companyName: "Rent the Runway, Inc. 10-K",
      ticker: "RENT",
      filingDate: "2026-04-14",
    },
    requiredTexts: [
      "Workspace Snapshot",
      "Selected Filing",
      "Collector DB",
      "Collector updated:",
      "Parser:",
      "Freshness:",
      "Data Readiness",
      "Filing catalog",
      "Local filing text",
      "Parser graph",
      "Decision Quality",
      "Evidence, freshness, and runtime checks",
      "Brief evidence",
      "Graph evidence",
      "Runtime reliability",
      "Graph Evidence",
      "A2UI Dashboard",
      "Investment Frame",
      "Bull Case",
      "Bear Case",
      "Unknowns",
    ],
    forbiddenTexts: [
      "Apple Hospitality REIT",
      "PATRIOT GOLD CORP",
      "모델 기반 브리프 생성이 실패",
    ],
  },
  {
    name: "chargepoint-inline-panels",
    prompt:
      "Build an investment brief for ChargePoint using its latest 10-K. Focus on liquidity risk, debt, and whether the thesis looks speculative.",
    expectedFiling: {
      companyName: "ChargePoint Holdings, Inc. 10-K",
      ticker: "CHPT",
      filingDate: "2026-04-02",
    },
    requiredTexts: [
      "Workspace Snapshot",
      "Selected Filing",
      "Collector DB",
      "Collector updated:",
      "Parser:",
      "Freshness:",
      "Data Readiness",
      "Filing catalog",
      "Local filing text",
      "Parser graph",
      "Decision Quality",
      "Evidence, freshness, and runtime checks",
      "Brief evidence",
      "Graph evidence",
      "Runtime reliability",
      "Graph Evidence",
      "A2UI Dashboard",
      "Grounded evidence for ChargePoint Holdings, Inc.",
      "Investment Frame",
      "Bull Case",
      "Bear Case",
      "Unknowns",
    ],
    forbiddenTexts: [
      "Apple Hospitality REIT",
      "PATRIOT GOLD CORP",
      "Rent the Runway, Inc. 10-K",
      "모델 기반 브리프 생성이 실패",
    ],
  },
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isIgnorableConsoleMessage(message: string) {
  return /warning: The resource .*\/_next\/static\/media\/[^ ]+\.woff2(?:\?[^ ]*)? was preloaded using link preload but not used/i.test(
    message
  );
}

async function fillVisibleTextarea(page: Page, value: string) {
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
    { timeout: 120_000 }
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

  expect(filled).toBeTruthy();
}

async function submitPrompt(page: Page) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const target = await page.evaluate(() => {
      const isVisibleElement = (element: Element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.top < window.innerHeight
        );
      };

      const textareas = Array.from(
        document.querySelectorAll('[data-testid="copilot-chat-textarea"]')
      ).filter(
        (node): node is HTMLTextAreaElement =>
          node instanceof HTMLTextAreaElement &&
          node.value.trim().length > 0 &&
          isVisibleElement(node)
      );

      const textarea = textareas.at(-1);
      if (!textarea) {
        return null;
      }

      textarea.scrollIntoView({ block: "center", inline: "nearest" });
      const textareaRect = textarea.getBoundingClientRect();
      const textareaCenter = {
        x: textareaRect.left + textareaRect.width / 2,
        y: textareaRect.top + textareaRect.height / 2,
      };

      const candidates = Array.from(
        document.querySelectorAll('[data-testid="copilot-send-button"]')
      )
        .filter(
          (node): node is HTMLButtonElement =>
            node instanceof HTMLButtonElement &&
            !node.disabled &&
            node.getAttribute("aria-disabled") !== "true" &&
            isVisibleElement(node)
        )
        .map((button) => {
          const rect = button.getBoundingClientRect();
          const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };

          return {
            button,
            distance:
              (center.x - textareaCenter.x) ** 2 +
              (center.y - textareaCenter.y) ** 2,
          };
        })
        .sort((left, right) => left.distance - right.distance);

      const button = candidates[0]?.button;
      if (!button) {
        return null;
      }

      button.scrollIntoView({ block: "center", inline: "nearest" });
      const buttonRect = button.getBoundingClientRect();

      return {
        x: buttonRect.left + buttonRect.width / 2,
        y: buttonRect.top + buttonRect.height / 2,
      };
    });

    if (target) {
      await page.mouse.click(target.x, target.y);
      const submitted = await page
        .waitForFunction(
          () => {
            const textareas = Array.from(
              document.querySelectorAll('[data-testid="copilot-chat-textarea"]')
            ).filter((node): node is HTMLTextAreaElement => {
              if (!(node instanceof HTMLTextAreaElement)) {
                return false;
              }

              const style = window.getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
              );
            });

            const hasPendingText = textareas.some(
              (textarea) => textarea.value.trim().length > 0
            );
            const hasDisabledSendButton = Array.from(
              document.querySelectorAll('[data-testid="copilot-send-button"]')
            ).some((node) => {
              if (!(node instanceof HTMLButtonElement)) {
                return false;
              }

              const style = window.getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0 &&
                (node.disabled || node.getAttribute("aria-disabled") === "true")
              );
            });

            return !hasPendingText || hasDisabledSendButton;
          },
          undefined,
          { timeout: 5000 }
        )
        .then(() => true)
        .catch(() => false);

      if (submitted) {
        return;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error("No visible enabled send button found.");
}

async function clickVisibleNewChatButton(page: Page) {
  const clicked = await page.evaluate(() => {
    for (const node of document.querySelectorAll(
      'button[aria-label="New Chat"]'
    )) {
      if (!(node instanceof HTMLButtonElement)) {
        continue;
      }

      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const isVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight;

      if (!isVisible) {
        continue;
      }

      node.click();
      return true;
    }

    return false;
  });

  expect(clicked).toBeTruthy();
}

test.describe.configure({ mode: "serial" });

for (const scenario of SCENARIOS) {
  test(`investment assistant renders inline panels for ${scenario.name}`, async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        const line = `${message.type()}: ${message.text()}`;

        if (isIgnorableConsoleMessage(line)) {
          return;
        }

        consoleMessages.push(line);
      }
    });

    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown";
      const line = `requestfailed: ${request.url()} ${failure}`;

      if (
        /\/api\/copilotkit\/agent\/investment-assistant\/connect .*ERR_ABORTED/i.test(
          line
        )
      ) {
        return;
      }

      if (/\/\?_rsc=.*ERR_ABORTED/i.test(line)) {
        return;
      }

      consoleMessages.push(line);
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
    await expect(
      page.getByText("Filing-first investment copilot", { exact: true })
    ).toBeVisible();

    await fillVisibleTextarea(page, scenario.prompt);
    await submitPrompt(page);

    await page.waitForFunction(
      ({ companyName, ticker, filingDate }) => {
        const body = document.body.innerText;
        const normalizedBody = body.replace(/\s+/g, " ").trim().toLowerCase();
        const dateRegex = new RegExp(
          `${ticker}\\s*·\\s*${filingDate}(?:t\\d{2}:\\d{2}:\\d{2}\\.\\d{3}z)?`,
          "i"
        );

        return (
          normalizedBody.includes(
            String(companyName).replace(/\s+/g, " ").trim().toLowerCase()
          ) && dateRegex.test(body)
        );
      },
      scenario.expectedFiling,
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
      scenario.requiredTexts,
      { timeout: 120_000 }
    );

    const body = await page.locator("body").innerText();
    const normalizedBody = normalizeText(body);

    expect(
      normalizedBody.includes(
        normalizeText(scenario.expectedFiling.companyName)
      )
    ).toBeTruthy();

    expect(
      new RegExp(
        `${scenario.expectedFiling.ticker}\\s*·\\s*${scenario.expectedFiling.filingDate}(?:t\\d{2}:\\d{2}:\\d{2}\\.\\d{3}z)?`,
        "i"
      ).test(body)
    ).toBeTruthy();

    for (const text of scenario.requiredTexts) {
      expect(normalizedBody.includes(normalizeText(text))).toBeTruthy();
    }

    for (const text of scenario.forbiddenTexts) {
      expect(normalizedBody.includes(normalizeText(text))).toBeFalsy();
    }

    expect(consoleMessages).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`${scenario.name}.png`),
      fullPage: true,
    });
  });
}

test("investment assistant resets state when New Chat is clicked", async ({
  page,
}) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    "Build an investment brief for Apple using its latest 10-K. Focus on main risks and whether the thesis looks cautious."
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Apple Inc\. 10-K/i.test(body) &&
        /AAPL\s*·\s*2025-10-31(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?/i.test(body) &&
        /Decision Quality/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const beforeThread = new URL(page.url()).searchParams.get("thread");

  await clickVisibleNewChatButton(page);

  await page.waitForFunction(
    ({ previousThread }) => {
      const nextUrl = new URL(window.location.href);
      const nextThread = nextUrl.searchParams.get("thread");
      const body = document.body.innerText;

      return (
        Boolean(nextThread) &&
        nextThread !== previousThread &&
        body.includes(
          "No filing selected yet. Start with a company name, ticker, or CIK."
        ) &&
        !body.includes("Apple Inc. 10-K") &&
        !body.includes("Build an investment brief for Apple")
      );
    },
    {
      previousThread: beforeThread,
    },
    { timeout: 120_000 }
  );

  const nextThread = new URL(page.url()).searchParams.get("thread");
  expect(nextThread).toBeTruthy();
  expect(nextThread).not.toBe(beforeThread);
});

test("investment assistant shows runtime status when parser stream fails", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    [
      "Build an investment brief for Apple using its latest 10-K.",
      "Focus on main risks and whether the thesis looks cautious.",
      "__simulate_parser_runtime_unavailable__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Runtime Status/i.test(body) &&
        /Parser runtime unavailable/i.test(body) &&
        /port 3406/i.test(body) &&
        /Apple Inc\. 10-K/i.test(body) &&
        /Collector DB/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(normalizedBody.includes(normalizeText("Runtime Status"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Parser runtime unavailable"))
  ).toBeTruthy();
  expect(normalizedBody.includes(normalizeText("port 3406"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("parser-runtime-degraded.png"),
    fullPage: true,
  });
});

test("investment assistant shows runtime status when graph evidence fails", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    [
      "Build an investment brief for Apple using its latest 10-K.",
      "Focus on main risks and whether the thesis looks cautious.",
      "__simulate_graph_rag_unavailable__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Runtime Status/i.test(body) &&
        /Graph evidence unavailable/i.test(body) &&
        /Graph RAG service/i.test(body) &&
        /Neo4j container/i.test(body) &&
        /Apple Inc\. 10-K/i.test(body) &&
        /Collector DB/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(normalizedBody.includes(normalizeText("Runtime Status"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Graph evidence unavailable"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Graph RAG service"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("graph-rag-degraded.png"),
    fullPage: true,
  });
});

test("investment assistant shows runtime status when filing text fails", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    [
      "Build an investment brief for Apple using its latest 10-K.",
      "Focus on main risks and whether the thesis looks cautious.",
      "__simulate_filing_reader_unavailable__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Runtime Status/i.test(body) &&
        /Filing text unavailable/i.test(body) &&
        /collector data directory/i.test(body) &&
        /downloaded filing file path/i.test(body) &&
        /Apple Inc\. 10-K/i.test(body) &&
        /Collector DB/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(normalizedBody.includes(normalizeText("Runtime Status"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Filing text unavailable"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("collector data directory"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("filing-reader-degraded.png"),
    fullPage: true,
  });
});

test("investment assistant shows runtime status when filing catalog fails", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    [
      "Build an investment brief for Apple using its latest 10-K.",
      "Focus on main risks and whether the thesis looks cautious.",
      "__simulate_filing_catalog_unavailable__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Runtime Status/i.test(body) &&
        /Filing catalog unavailable/i.test(body) &&
        /PostgreSQL service/i.test(body) &&
        /collector schema/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(normalizedBody.includes(normalizeText("Runtime Status"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Filing catalog unavailable"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("PostgreSQL service"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("filing-catalog-degraded.png"),
    fullPage: true,
  });
});

test("investment assistant preserves selected filing when selected lookup fails", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    "Build an investment brief for Apple using its latest 10-K. Focus on main risks and whether the thesis looks cautious."
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Apple Inc\. 10-K/i.test(body) &&
        /AAPL\s*·\s*2025-10-31(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?/i.test(body) &&
        /Collector DB/i.test(body) &&
        /Decision Quality/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  await fillVisibleTextarea(
    page,
    [
      "Use the selected filing context again and refresh the workspace snapshot.",
      "__simulate_selected_filing_lookup_unavailable__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Runtime Status/i.test(body) &&
        /Selected filing lookup unavailable/i.test(body) &&
        /PostgreSQL service/i.test(body) &&
        /Apple Inc\. 10-K/i.test(body) &&
        /Collector DB/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(normalizedBody.includes(normalizeText("Runtime Status"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Selected filing lookup unavailable"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Apple Inc. 10-K"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("selected-filing-lookup-degraded.png"),
    fullPage: true,
  });
});

test("investment assistant shows stale freshness refresh guidance", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    [
      "Build an investment brief for Apple using its latest 10-K.",
      "Focus on main risks and whether the thesis looks cautious.",
      "__simulate_stale_filing_freshness__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Apple Inc\. 10-K/i.test(body) &&
        /Data Readiness/i.test(body) &&
        /Filing freshness/i.test(body) &&
        /Action needed/i.test(body) &&
        /Freshness:\s*refresh recommended/i.test(body) &&
        /Decision Quality/i.test(body) &&
        /Decision Quality:\s*(Review needed|Blocked)/i.test(body) &&
        /Filing freshness/i.test(body) &&
        /Collector row was last refreshed/i.test(body) &&
        /Run company sync, filing metadata sync, download, and parser jobs/i.test(
          body
        ) &&
        /A2UI Dashboard/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(
    normalizedBody.includes(normalizeText("Freshness: refresh recommended"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Decision Quality"))
  ).toBeTruthy();
  expect(normalizedBody.includes(normalizeText("Data Readiness"))).toBeTruthy();
  expect(normalizedBody.includes(normalizeText("Action needed"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Filing freshness"))
  ).toBeTruthy();
  expect(
    /Decision Quality:\s*(Review needed|Blocked)/i.test(body)
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Collector row was last refreshed"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(
      normalizeText(
        "Run company sync, filing metadata sync, download, and parser jobs"
      )
    )
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("stale-freshness-refresh-guidance.png"),
    fullPage: true,
  });
});

test("investment assistant shows unknown freshness refresh guidance", async ({
  page,
}, testInfo) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await expect(
    page.getByText("Filing-first investment copilot", { exact: true })
  ).toBeVisible();

  await fillVisibleTextarea(
    page,
    [
      "Build an investment brief for Apple using its latest 10-K.",
      "Focus on main risks and whether the thesis looks cautious.",
      "__simulate_unknown_filing_freshness__",
    ].join(" ")
  );
  await submitPrompt(page);

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        /Apple Inc\. 10-K/i.test(body) &&
        /Data Readiness/i.test(body) &&
        /Filing freshness/i.test(body) &&
        /Action needed/i.test(body) &&
        /Collector updated:\s*unknown/i.test(body) &&
        /Freshness:\s*unknown/i.test(body) &&
        /Decision Quality/i.test(body) &&
        /Decision Quality:\s*(Review needed|Blocked)/i.test(body) &&
        /Filing freshness/i.test(body) &&
        /Collector update timestamp is unavailable/i.test(body) &&
        /Run the collector metadata and download jobs/i.test(body) &&
        /A2UI Dashboard/i.test(body)
      );
    },
    undefined,
    { timeout: 120_000 }
  );

  const body = await page.locator("body").innerText();
  const normalizedBody = normalizeText(body);

  expect(
    normalizedBody.includes(normalizeText("Freshness: unknown"))
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Decision Quality"))
  ).toBeTruthy();
  expect(normalizedBody.includes(normalizeText("Data Readiness"))).toBeTruthy();
  expect(normalizedBody.includes(normalizeText("Action needed"))).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Filing freshness"))
  ).toBeTruthy();
  expect(
    /Decision Quality:\s*(Review needed|Blocked)/i.test(body)
  ).toBeTruthy();
  expect(
    normalizedBody.includes(
      normalizeText("Collector update timestamp is unavailable")
    )
  ).toBeTruthy();
  expect(
    normalizedBody.includes(
      normalizeText("Run the collector metadata and download jobs")
    )
  ).toBeTruthy();
  expect(
    normalizedBody.includes(normalizeText("Investment assistant error"))
  ).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("unknown-freshness-refresh-guidance.png"),
    fullPage: true,
  });
});
