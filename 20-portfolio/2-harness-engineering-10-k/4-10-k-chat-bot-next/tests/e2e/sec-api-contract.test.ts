import { expect, type Page, test } from "@playwright/test";

const BASE_URL =
  process.env.CHATBOT_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://127.0.0.1:3003/";

function appUrl(path: string) {
  return new URL(path, BASE_URL).toString();
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, `${label} should be an object`).toEqual(expect.any(Object));
  return value as Record<string, unknown>;
}

function expectString(value: unknown, label: string) {
  expect(typeof value, `${label} should be a string`).toBe("string");
  return value as string;
}

function expectRequestIdHeader(response: {
  headers(): Record<string, string>;
}) {
  const requestId = response.headers()["x-request-id"];
  expectString(requestId, "x-request-id response header");
  return requestId;
}

async function signInAsGuest(page: Page) {
  await page.goto(
    appUrl("/api/auth/guest?redirectUrl=%2Fapi%2Fauth%2Fsession"),
    {
      waitUntil: "networkidle",
      timeout: 120_000,
    }
  );

  const sessionResponse = await page.request.get(appUrl("/api/auth/session"));
  expect(sessionResponse.status()).toBe(200);

  const session = expectRecord(await sessionResponse.json(), "session");
  const user = expectRecord(session.user, "session.user");
  expectString(user.id, "session.user.id");
}

test("SEC API rejects unauthenticated filing requests", async ({ request }) => {
  const response = await request.get(
    appUrl("/api/sec/filings?companyQuery=AAPL&limit=1")
  );

  expect(response.status()).toBe(401);
  expectString(
    response.headers()["x-request-id"],
    "unauthorized x-request-id response header"
  );

  const body = expectRecord(await response.json(), "unauthorized response");
  expect(body.code).toBe("unauthorized:chat");
  expectString(body.message, "unauthorized message");
});

test("SEC API returns authenticated filing list and full-text reader payload", async ({
  page,
}) => {
  await signInAsGuest(page);

  const filingsResponse = await page.request.get(
    appUrl("/api/sec/filings?companyQuery=AAPL&limit=999&cursor=-5")
  );

  expect(filingsResponse.status()).toBe(200);
  expectRequestIdHeader(filingsResponse);

  const filingsBody = expectRecord(
    await filingsResponse.json(),
    "filings response"
  );
  const company = expectRecord(filingsBody.company, "filings response company");
  expect(company.ticker).toBe("AAPL");

  expect(Array.isArray(filingsBody.filings)).toBeTruthy();
  const filings = filingsBody.filings as Record<string, unknown>[];
  expect(filings.length).toBeGreaterThan(0);
  expect(filings.length).toBeLessThanOrEqual(50);
  expect(filings[0]?.ticker).toBe("AAPL");
  expectString(filings[0]?.accessionNo, "first filing accessionNo");

  const fullTextResponse = await page.request.post(
    appUrl("/api/sec/full-text"),
    {
      data: {
        companyQuery: "AAPL",
        targetPeriod: "annual",
      },
    }
  );

  expect(fullTextResponse.status()).toBe(200);
  expectRequestIdHeader(fullTextResponse);

  const fullTextBody = expectRecord(
    await fullTextResponse.json(),
    "full-text response"
  );
  const filing = expectRecord(fullTextBody.filing, "full-text filing");
  const reader = expectRecord(fullTextBody.reader, "full-text reader");
  expect(filing.ticker).toBe("AAPL");
  expectString(filing.accessionNo, "full-text filing accessionNo");
  expect(Array.isArray(reader.toc)).toBeTruthy();
  expect(Array.isArray(reader.keyItems)).toBeTruthy();
  expect(expectString(reader.markdownPreview, "markdown preview")).toContain(
    "Apple Inc."
  );
});

test("SEC API returns structured bad-request problems", async ({ page }) => {
  await signInAsGuest(page);

  const blankFilings = await page.request.get(
    appUrl("/api/sec/filings?companyQuery=%20%20%20&limit=1")
  );
  expect(blankFilings.status()).toBe(400);
  const blankFilingsRequestId = expectRequestIdHeader(blankFilings);
  const blankFilingsBody = expectRecord(
    await blankFilings.json(),
    "blank filings response"
  );
  const blankFilingsError = expectRecord(
    blankFilingsBody.error,
    "blank filings error"
  );
  expect(blankFilingsError.code).toBe("sec_bad_request");
  expect(blankFilingsError.requestId).toBe(blankFilingsRequestId);
  expect(
    expectString(blankFilingsError.recovery, "blank filings recovery")
  ).toMatch(/request parameters/);

  const blankFullText = await page.request.post(appUrl("/api/sec/full-text"), {
    data: {
      companyQuery: "   ",
      targetPeriod: "annual",
    },
  });
  expect(blankFullText.status()).toBe(400);
  const blankFullTextRequestId = expectRequestIdHeader(blankFullText);
  const blankFullTextBody = expectRecord(
    await blankFullText.json(),
    "blank full-text response"
  );
  const blankFullTextError = expectRecord(
    blankFullTextBody.error,
    "blank full-text error"
  );
  expect(blankFullTextError.code).toBe("sec_bad_request");
  expect(blankFullTextError.requestId).toBe(blankFullTextRequestId);
  expect(expectString(blankFullTextError.cause, "blank full-text cause")).toBe(
    "Invalid request body"
  );
});

test("SEC API exposes structured recovery problems for operator failures", async ({
  page,
}) => {
  await signInAsGuest(page);

  const companyMiss = await page.request.get(
    appUrl("/api/sec/filings?companyQuery=ZZZNOSECAPISMOKE&limit=1")
  );
  expect(companyMiss.status()).toBe(404);
  const companyMissRequestId = expectRequestIdHeader(companyMiss);
  const companyMissBody = expectRecord(
    await companyMiss.json(),
    "company miss response"
  );
  const companyMissError = expectRecord(
    companyMissBody.error,
    "company miss error"
  );
  expect(companyMissError.code).toBe("sec_company_not_found");
  expect(companyMissError.requestId).toBe(companyMissRequestId);
  expect(
    expectString(companyMissError.recovery, "company miss recovery")
  ).toMatch(/companies:sync/);

  const emptyForms = await page.request.get(
    appUrl("/api/sec/filings?companyQuery=AAPL&forms=NOT-A-FORM&limit=5")
  );
  expect(emptyForms.status()).toBe(200);
  const emptyFormsRequestId = expectRequestIdHeader(emptyForms);
  const emptyFormsBody = expectRecord(
    await emptyForms.json(),
    "empty forms response"
  );
  expect(Array.isArray(emptyFormsBody.filings)).toBeTruthy();
  expect(emptyFormsBody.filings).toHaveLength(0);
  const notice = expectRecord(emptyFormsBody.notice, "empty forms notice");
  expect(notice.code).toBe("sec_filing_not_found");
  expect(notice.requestId).toBe(emptyFormsRequestId);
  expect(expectString(notice.recovery, "empty forms recovery")).toMatch(
    /Loosen the form filter/
  );

  const filingMiss = await page.request.post(appUrl("/api/sec/full-text"), {
    data: {
      companyQuery: "ZZZNOSECAPISMOKE",
      targetPeriod: "annual",
    },
  });
  expect(filingMiss.status()).toBe(404);
  const filingMissRequestId = expectRequestIdHeader(filingMiss);
  const filingMissBody = expectRecord(
    await filingMiss.json(),
    "filing miss response"
  );
  const filingMissError = expectRecord(
    filingMissBody.error,
    "filing miss error"
  );
  expect(filingMissError.code).toBe("sec_filing_not_found");
  expect(filingMissError.requestId).toBe(filingMissRequestId);
  expect(
    expectString(filingMissError.recovery, "filing miss recovery")
  ).toMatch(/metadata sync/);
});
