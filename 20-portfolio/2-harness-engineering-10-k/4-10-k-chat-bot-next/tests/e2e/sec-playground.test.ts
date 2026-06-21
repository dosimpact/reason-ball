import { expect, type Page, test } from "@playwright/test";

const BASE_URL =
  process.env.CHATBOT_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://127.0.0.1:3003/";

function appUrl(path: string) {
  return new URL(path, BASE_URL).toString();
}

function problemPanel(page: Page) {
  return page.locator('div[role="alert"]').filter({ hasText: "Code:" }).first();
}

async function openPlaygroundAsGuest(page: Page) {
  await page.goto(
    appUrl("/api/auth/guest?redirectUrl=%2Fadmin%2Fsec-playground"),
    {
      waitUntil: "networkidle",
      timeout: 120_000,
    }
  );

  await expect(
    page.getByRole("heading", { name: "SEC Playground (Admin)" })
  ).toBeVisible();
}

test("SEC playground shows selected-filing recovery before summary or brief", async ({
  page,
}) => {
  await openPlaygroundAsGuest(page);

  await page.getByRole("button", { name: "3) Summary" }).click();
  await expect(problemPanel(page)).toContainText(
    "Run filings list first so a filing can be selected."
  );
  await expect(problemPanel(page)).toContainText(
    "Code: sec_no_selected_filing"
  );
  await expect(problemPanel(page)).toContainText(
    "Click Filings, confirm at least one row is returned, then retry Summary."
  );

  await page.getByRole("button", { name: "4) Brief" }).click();
  await expect(problemPanel(page)).toContainText(
    "Run filings list first so a filing can be selected."
  );
  await expect(problemPanel(page)).toContainText(
    "Click Filings, confirm at least one row is returned, then retry Brief."
  );
});

test("SEC playground displays structured API recovery panels", async ({
  page,
}) => {
  await openPlaygroundAsGuest(page);

  await page.getByLabel("Company").fill("ZZZNOSECPLAYGROUND");
  await page.getByRole("button", { name: "1) Filings" }).click();

  await expect(problemPanel(page)).toContainText(
    'No SEC company match was found for "ZZZNOSECPLAYGROUND".'
  );
  await expect(problemPanel(page)).toContainText("Code: sec_company_not_found");
  await expect(problemPanel(page)).toContainText(
    "pnpm --filter @10k/collector run companies:sync"
  );

  await page.getByRole("button", { name: "2) Full Text" }).click();
  await expect(problemPanel(page)).toContainText(
    'No SEC filing was found for company query "ZZZNOSECPLAYGROUND".'
  );
  await expect(problemPanel(page)).toContainText("Code: sec_filing_not_found");
  await expect(problemPanel(page)).toContainText(
    "Run the collector filing metadata sync and download jobs"
  );
});

test("SEC playground clears stale filing selection when company input changes", async ({
  page,
}) => {
  await openPlaygroundAsGuest(page);

  await page.getByLabel("Company").fill("AAPL");
  await page.getByRole("button", { name: "1) Filings" }).click();

  await expect(page.getByText("filings completed (200)")).toBeVisible();
  await expect(
    page.getByText("Selected filing for summary/brief")
  ).toBeVisible();

  await page.getByLabel("Company").fill("   ");

  await expect(
    page.getByText("Selected filing for summary/brief")
  ).toBeHidden();
  await page.getByRole("button", { name: "1) Filings" }).click();
  await expect(problemPanel(page)).toContainText("Company is required.");
  await expect(problemPanel(page)).toContainText("Code: sec_bad_request");
  await expect(problemPanel(page)).toContainText(
    "Enter a ticker, CIK, or company name, then retry."
  );

  await page.getByRole("button", { name: "3) Summary" }).click();
  await expect(problemPanel(page)).toContainText(
    "Run filings list first so a filing can be selected."
  );
});

test("SEC playground renders successful filing and full-text responses", async ({
  page,
}) => {
  await openPlaygroundAsGuest(page);

  await page.getByLabel("Company").fill("AAPL");
  await page.getByRole("button", { name: "1) Filings" }).click();

  await expect(page.getByText("filings completed (200)")).toBeVisible();
  await expect(
    page.getByText("Selected filing for summary/brief")
  ).toBeVisible();
  await expect(page.getByText(/Apple Inc\. \(AAPL\) -/)).toBeVisible();
  await expect(
    page.locator("section", { hasText: "Filings Response" })
  ).toContainText('"ticker": "AAPL"');

  await page.getByRole("button", { name: "2) Full Text" }).click();

  await expect(page.getByText("full-text completed (200)")).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.locator("section", { hasText: "Full Text Response" })
  ).toContainText('"markdownPreview"');
  await expect(
    page.locator("section", { hasText: "Full Text Response" })
  ).toContainText("Apple Inc.");
});
