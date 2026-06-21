import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "multimodal_voice_input";
const TEST_AUDIO_NAME = "e2e-multimodal-voice-input.wav";
const TEST_AUDIO_MIME_TYPE = "audio/wav";

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

function createTestWavBuffer() {
  const sampleRate = 8_000;
  const durationSeconds = 0.4;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  function writeString(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((index / sampleRate) * 2 * Math.PI * 440) * 4_000);
    view.setInt16(44 + index * bytesPerSample, sample, true);
  }

  return bytes;
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

async function panelByAnyName(page: Page, names: RegExp[]) {
  for (const name of names) {
    const panel = await namedPanel(page, name);
    if (await isVisible(panel)) return panel;
  }

  return namedPanel(page, names[0]);
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function langGraphApiInput(page: Page) {
  const root = workspace(page);
  return root.getByRole("textbox", { name: /api url|langgraph api url/i }).first();
}

function voicePromptInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Voice prompt$/i })
    .or(root.getByRole("textbox", { name: /voice prompt|audio prompt|prompt|instruction|question/i }))
    .or(root.getByPlaceholder(/voice prompt|audio prompt|prompt|transcription|question|instruction/i))
    .or(root.locator("textarea"))
    .first();
}

function fileUploadInput(page: Page) {
  const root = workspace(page);
  return root.locator("input[type='file'][accept*='audio'], input[type='file']").first();
}

function audioUploadControl(page: Page) {
  const root = workspace(page);
  return root
    .getByLabel(/audio file|voice file|audio upload|upload audio|choose audio|select audio|file upload/i)
    .or(
      root.getByRole("button", {
        name: /upload audio|choose audio|select audio|audio file|voice file|browse/i,
      }),
    )
    .or(root.locator("label").filter({ hasText: /upload|choose|select|audio file|voice file|file/i }))
    .or(root.locator("input[type='file']"))
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function sampleAudioButton(page: Page) {
  return actionButton(page, /sample audio|use sample|demo audio|example audio/i);
}

function transcribeAudioButton(page: Page) {
  return actionButton(
    page,
    /^Transcribe audio$|^Generate transcription$|^Preview transcription$|^Create transcript$|transcribe|transcription preview|generate transcript/i,
  );
}

function runVoiceAnalysisButton(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("button", { name: /^Run voice analysis$/i })
    .or(root.getByRole("button", { name: /^Run voice input$/i }))
    .or(root.getByRole("button", { name: /^Run audio analysis$/i }))
    .or(root.getByRole("button", { name: /^Send voice input$/i }))
    .or(root.getByRole("button", { name: /run voice|run audio|analy[sz]e voice|analy[sz]e audio|send voice/i }))
    .first();
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
      name: /27\s+Multimodal Input:\s*Voice(?:\s+(?:implemented|planned))?$/i,
    })
    .click();

  await expect(
    page.getByRole("heading", { name: /^(?:27\s+)?Multimodal Input:\s*Voice$/i }),
  ).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(API_URL);
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(
        /waiting|no .* yet|run .* to .*|empty|not available|appears after .*|pending/gi,
        "",
      ),
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
      ".audio-event",
      ".voice-event",
      ".metadata-event",
      ".transcription-event",
      "[class*='event' i]",
      "[class*='audio' i]",
      "[class*='voice' i]",
      "[class*='transcription' i]",
      "[data-testid*='event' i]",
      "[data-testid*='stream' i]",
      "[data-testid*='audio' i]",
      "article",
      "details",
      "pre",
      "code",
      "li",
      "tr",
    ].join(", "),
  );
}

function audioPreviewMedia(panel: Locator) {
  return panel.locator(
    [
      "audio",
      "canvas",
      "[data-testid*='audio-preview' i]",
      "[data-testid*='voice-preview' i]",
      "[class*='audio-preview' i]",
      "[class*='waveform' i]",
      "[class*='voice-preview' i]",
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

async function assertAudioInputFallbackAvailable(page: Page) {
  await expect
    .poll(
      async () => {
        if ((await fileUploadInput(page).count()) > 0) return 1;
        if (await isVisible(audioUploadControl(page))) return 1;
        return (await isVisible(sampleAudioButton(page))) ? 1 : 0;
      },
      { timeout: 10_000 },
    )
    .toBe(1);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(voicePromptInput(page)).toBeVisible();
  await assertAudioInputFallbackAvailable(page);
  await expect(runVoiceAnalysisButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  const panelGroups = [
    [/audio preview/i, /voice preview/i, /selected audio/i],
    [/transcription preview/i, /transcript preview/i, /transcript/i],
    [/audio metadata/i, /voice metadata/i],
    [/final answer/i, /voice response/i, /audio response/i, /assistant response/i],
    [/final state/i],
    [/raw stream events/i],
  ];

  for (const names of panelGroups) {
    await expect(await panelByAnyName(page, names)).toBeVisible();
  }
}

async function provideAudioInput(page: Page) {
  if (await isVisible(sampleAudioButton(page))) {
    await sampleAudioButton(page).click();
    return;
  }

  const input = fileUploadInput(page);
  if ((await input.count()) > 0) {
    await input.setInputFiles({
      name: TEST_AUDIO_NAME,
      mimeType: TEST_AUDIO_MIME_TYPE,
      buffer: createTestWavBuffer() as never,
    });
    return;
  }

  const uploadControl = audioUploadControl(page);
  await expect(uploadControl).toBeVisible();
  const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 }).catch(() => null);
  await uploadControl.click();
  const fileChooser = await fileChooserPromise;
  if (fileChooser) {
    await fileChooser.setFiles({
      name: TEST_AUDIO_NAME,
      mimeType: TEST_AUDIO_MIME_TYPE,
      buffer: createTestWavBuffer() as never,
    });
  }
}

async function triggerTranscriptionIfAvailable(page: Page) {
  const button = transcribeAudioButton(page);
  if (!(await isVisible(button))) return false;
  if (!(await button.isEnabled().catch(() => false))) return false;
  await button.click();
  return true;
}

async function assertAudioPreview(page: Page) {
  const panel = await panelByAnyName(page, [/audio preview/i, /voice preview/i, /selected audio/i]);
  await expect(panel).toBeVisible();
  await expect
    .poll(
      async () => {
        const media = audioPreviewMedia(panel);
        const count = await media.count();
        for (let index = 0; index < count; index += 1) {
          if (await media.nth(index).isVisible().catch(() => false)) return 1;
        }

        const body = await panelBodyText(panel, /audio preview|voice preview|selected audio/i);
        return /audio|voice|sample|selected|uploaded|ready|duration|wav|mp3|mpeg|webm|ogg/i.test(body)
          ? 1
          : 0;
      },
      { timeout: 30_000 },
    )
    .toBe(1);
}

async function assertAudioMetadata(page: Page) {
  const panel = await panelByAnyName(page, [/audio metadata/i, /voice metadata/i]);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /audio metadata|voice metadata/i,
    /audio|voice|sample|metadata|wav|mp3|mpeg|webm|ogg|mime|file|size|bytes|duration|seconds|source/i,
    45_000,
  );
  await expect(panel).toContainText(
    /[1-9]\d*\s*(?:bytes?|s|sec|seconds?)|sample|audio\/|wav|mp3|mpeg|webm|ogg|e2e-multimodal-voice-input/i,
  );
}

async function assertTranscriptionPreview(page: Page) {
  const panel = await panelByAnyName(page, [
    /transcription preview/i,
    /transcript preview/i,
    /transcript/i,
  ]);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /transcription preview|transcript preview|transcript/i,
    /[A-Za-z][\s\S]{8,}/,
    120_000,
  );
  await expect(panel).not.toContainText(/no transcription yet|waiting for transcription|not available/i);
}

async function assertFinalResponse(page: Page) {
  const panel = await panelByAnyName(page, [
    /final answer/i,
    /voice response/i,
    /audio response/i,
    /assistant response/i,
  ]);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final answer|voice response|audio response|assistant response/i,
    /[A-Za-z][\s\S]{12,}/,
    120_000,
  );
  await expect(panel).not.toContainText(/no final answer yet|no response yet|waiting/i);
}

async function assertFinalState(page: Page, options: { marker: string }) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /audio|voice|metadata|transcript|transcription|answer|response|final_status|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.marker);

  for (const pattern of [
    fieldPattern("audio_metadata", "audioMetadata", "audio metadata"),
    fieldPattern("transcription", "transcript", "transcription_text", "transcriptionText"),
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
  await expect(panel).toContainText(/audio|voice|metadata|transcript|transcription|response|final/i);
}

test("Multimodal Input: Voice exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Multimodal Input: Voice streams transcription and final response", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const marker = `E2E multimodal voice input marker ${uniqueId}`;

  await provideAudioInput(page);
  await assertAudioPreview(page);
  await assertAudioMetadata(page);

  const seededPrompt = await voicePromptInput(page).inputValue();
  await voicePromptInput(page).fill(
    `${seededPrompt}\n\n${marker}: transcribe the voice input, include audio metadata, transcription preview, final response, and final_status.`,
  );

  const streamRequests = watchStreamRequests(page);
  if (await triggerTranscriptionIfAvailable(page)) {
    await assertTranscriptionPreview(page);
  }
  await runVoiceAnalysisButton(page).click();

  await assertAudioPreview(page);
  await assertAudioMetadata(page);
  await assertTranscriptionPreview(page);
  await assertFinalResponse(page);
  await assertFinalState(page, { marker });
  await assertRawStreamEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, [
    marker,
    /audio|voice|metadata|mime|duration|size|sample|e2e-multimodal-voice-input|audio\/wav|wav/i,
  ]);
});
