import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "multimodal_image_input";
const TEST_IMAGE_NAME = "e2e-multimodal-image-input.png";
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const TEST_IMAGE_BUFFER = Uint8Array.from(atob(TEST_IMAGE_BASE64), (char) => char.charCodeAt(0));

type StreamRequestRecord = {
  body: string;
  url: string;
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJson(value: string): JsonValue | undefined {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return undefined;
  }
}

function collectStrings(value: JsonValue | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);

  return Object.values(value).flatMap(collectStrings);
}

function collectStringValuesForKeys(
  value: JsonValue | undefined,
  keyPatternMatcher: RegExp,
): string[] {
  if (value === undefined || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValuesForKeys(item, keyPatternMatcher));
  }

  return Object.entries(value).flatMap(([key, childValue]) => {
    const childStrings = collectStringValuesForKeys(childValue, keyPatternMatcher);
    if (!keyPatternMatcher.test(key)) return childStrings;
    return [...collectStrings(childValue), ...childStrings];
  });
}

function fieldPattern(...fieldNames: string[]) {
  const variants = fieldNames.flatMap((fieldName) => [
    fieldName,
    fieldName.replace(/([a-z])([A-Z])/g, "$1_$2"),
    fieldName.replace(/_/g, " "),
    fieldName.replace(/_/g, "-"),
  ]);
  const sources = variants.map((variant) =>
    escapeRegExp(variant).replace(/[_\s-]+/g, "[_\\s-]*"),
  );

  return new RegExp(`\\b(?:${sources.join("|")})\\b`, "i");
}

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function namedPanel(page: Page, name: RegExp) {
  const region = page.getByRole("region", { name }).first();
  if ((await region.count()) > 0) return region;

  const classPanel = page.locator("[class*='panel']").filter({ hasText: name }).first();
  if ((await classPanel.count()) > 0) return classPanel;

  return page
    .locator("section, article, aside, details")
    .filter({ hasText: name })
    .filter({ has: page.locator(".panel-title, h2, h3, summary") })
    .last();
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function langGraphApiInput(page: Page) {
  const root = workspace(page);
  return root.getByRole("textbox", { name: /api url|langgraph api url/i }).first();
}

function imagePromptInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Image prompt$/i })
    .or(root.getByRole("textbox", { name: /image prompt|prompt|instruction|question/i }))
    .or(root.getByPlaceholder(/image prompt|prompt|describe|analy[sz]e|question|instruction/i))
    .or(root.locator("textarea"))
    .first();
}

function fileUploadInput(page: Page) {
  const root = workspace(page);
  return root.locator("input[type='file'][accept*='image'], input[type='file']").first();
}

function fileUploadControl(page: Page) {
  const root = workspace(page);
  return root
    .getByLabel(/image upload|upload image|choose image|select image|file upload|image file/i)
    .or(
      root.getByRole("button", {
        name: /upload image|choose image|select image|file upload|image file|browse/i,
      }),
    )
    .or(root.locator("label").filter({ hasText: /upload|choose|select|image file|file/i }))
    .or(root.locator("input[type='file']"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function sampleImageButton(page: Page) {
  return actionButton(page, /sample image|use sample|demo image|example image/i);
}

function runImageAnalysisButton(page: Page) {
  return actionButton(page, /^Run image analysis$/i);
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page
    .getByRole("button", {
      name: /26\s+Multimodal Input:\s*Image(?:\s+(?:implemented|planned))?$/i,
    })
    .click();

  await expect(
    page.getByRole("heading", { name: /^(?:26\s+)?Multimodal Input:\s*Image$/i }),
  ).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(API_URL);
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ""),
  );
}

async function waitForPanelText(
  panel: Locator,
  title: RegExp,
  textOrPattern: string | RegExp,
  timeout = 45_000,
) {
  const pattern =
    typeof textOrPattern === "string" ? new RegExp(escapeRegExp(textOrPattern)) : textOrPattern;
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).toMatch(pattern);
}

function eventCards(panel: Locator) {
  return panel.locator(
    [
      ".event-row",
      ".image-event",
      ".metadata-event",
      ".region-event",
      "[class*='event' i]",
      "[class*='image' i]",
      "[class*='region' i]",
      "[data-testid*='event' i]",
      "[data-testid*='stream' i]",
      "[data-testid*='image' i]",
      "article",
      "details",
      "pre",
      "code",
      "li",
      "tr",
    ].join(", "),
  );
}

function previewMedia(panel: Locator) {
  return panel.locator(
    [
      "img[src]",
      "canvas",
      "[role='img']",
      "[data-testid*='preview-image' i]",
      "[data-testid*='image-preview-media' i]",
      "[class*='preview-image' i]",
    ].join(", "),
  );
}

function watchStreamRequests(page: Page) {
  const records: StreamRequestRecord[] = [];
  const handler = (request: Request) => {
    if (request.method() !== "POST" || !request.url().includes("/runs/stream")) return;
    records.push({
      body: request.postData() ?? "",
      url: request.url(),
    });
  };

  page.on("request", handler);
  return {
    records,
    stop: () => page.off("request", handler),
  };
}

function assertStreamRequestBodies(
  records: StreamRequestRecord[],
  requiredPayloadMarkers: Array<string | RegExp>,
) {
  expect(records.length).toBeGreaterThanOrEqual(1);

  const serializedRecords = records
    .map((record) => {
      const parsed = parseJson(record.body);
      return `${record.url}\n${JSON.stringify(parsed ?? record.body)}`;
    })
    .join("\n");

  const streamModeText = records
    .flatMap((record) => {
      const parsed = parseJson(record.body);
      return collectStringValuesForKeys(parsed, /stream/i);
    })
    .join(" ");

  expect(serializedRecords).toContain(GRAPH_ID);
  expect(streamModeText || serializedRecords).toMatch(/\bupdates?\b/i);
  expect(streamModeText || serializedRecords).toMatch(/\bcustom\b/i);

  for (const marker of requiredPayloadMarkers) {
    if (typeof marker === "string") {
      expect(serializedRecords).toContain(marker);
    } else {
      expect(serializedRecords).toMatch(marker);
    }
  }
}

async function assertUploadControlAvailable(page: Page) {
  await expect
    .poll(
      async () => {
        if ((await fileUploadInput(page).count()) > 0) return 1;
        return (await isVisible(fileUploadControl(page))) ? 1 : 0;
      },
      { timeout: 10_000 },
    )
    .toBe(1);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(imagePromptInput(page)).toBeVisible();
  await assertUploadControlAvailable(page);
  await expect(sampleImageButton(page)).toBeVisible();
  await expect(runImageAnalysisButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  for (const panelName of [
    /image preview/i,
    /image analysis/i,
    /region notes/i,
    /image metadata/i,
    /final state/i,
    /raw stream events/i,
  ]) {
    await expect(await namedPanel(page, panelName)).toBeVisible();
  }
}

async function provideImageInput(page: Page) {
  if (await isVisible(sampleImageButton(page))) {
    await sampleImageButton(page).click();
    return;
  }

  const input = fileUploadInput(page);
  if ((await input.count()) > 0) {
    try {
      await input.setInputFiles({
        name: TEST_IMAGE_NAME,
        mimeType: "image/png",
        buffer: TEST_IMAGE_BUFFER as never,
      });
      return;
    } catch {
      // Fall through to the sample image control for implementations that proxy uploads.
    }
  }

  await expect(sampleImageButton(page)).toBeVisible();
  await sampleImageButton(page).click();
}

async function assertPreviewImage(page: Page) {
  const panel = await namedPanel(page, /image preview/i);
  await expect(panel).toBeVisible();
  await expect
    .poll(
      async () => {
        const media = previewMedia(panel);
        const count = await media.count();
        for (let index = 0; index < count; index += 1) {
          if (await media.nth(index).isVisible().catch(() => false)) return 1;
        }
        return 0;
      },
      { timeout: 30_000 },
    )
    .toBe(1);
}

async function assertImageAnalysis(page: Page) {
  const panel = await namedPanel(page, /image analysis/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(panel, /image analysis/i, /[A-Za-z][\s\S]{20,}/, 120_000);
  await expect(panel).not.toContainText(/no analysis yet|waiting/i);
}

async function assertRegionNotes(page: Page) {
  const panel = await namedPanel(page, /region notes/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /region notes/i,
    /region|area|object|foreground|background|observation|note|bbox|bounding|coordinate/i,
    90_000,
  );
}

async function assertImageMetadata(page: Page) {
  const panel = await namedPanel(page, /image metadata/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /image metadata/i,
    /image|metadata|png|mime|file|size|bytes|width|height|dimension/i,
    90_000,
  );
}

async function assertFinalState(page: Page, options: { marker: string }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /image|metadata|observations?|region|notes?|final_status|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.marker);

  for (const pattern of [
    fieldPattern("image_metadata", "imageMetadata", "image metadata"),
    fieldPattern("observations"),
    fieldPattern("region_notes", "regionNotes", "region notes"),
    fieldPattern("final_status", "finalStatus", "final status"),
  ]) {
    await expect(panel).toContainText(pattern);
  }
}

async function assertRawStreamEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(/image|metadata|analysis|observation|region|final/i);
}

test("Multimodal Input: Image exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Multimodal Input: Image streams image analysis and final state", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const marker = `E2E multimodal image input marker ${uniqueId}`;

  await provideImageInput(page);
  await assertPreviewImage(page);

  const seededPrompt = await imagePromptInput(page).inputValue();
  await imagePromptInput(page).fill(
    `${seededPrompt}\n\n${marker}: analyze the uploaded image, include image metadata, observations, region notes, and final_status.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runImageAnalysisButton(page).click();

  await assertPreviewImage(page);
  await assertImageAnalysis(page);
  await assertRegionNotes(page);
  await assertImageMetadata(page);
  await assertFinalState(page, { marker });
  await assertRawStreamEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, [marker]);
});
