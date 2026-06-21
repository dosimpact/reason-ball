import { expect, type Locator, type Page, type Request, test } from "@playwright/test";

test.setTimeout(180_000);

const API_URL = "http://localhost:2931";
const GRAPH_ID = "multimodal_voice_output";
const VOICE_OPTION_PATTERN =
  /\b(?:alloy|ash|ballad|coral|echo|fable|nova|onyx|sage|shimmer|verse|aria|roger|sarah)\b/i;
const FORMAT_OPTION_PATTERN = /\b(?:mp3|mpeg|wav|wave|webm|ogg|opus|aac|flac|pcm)\b/i;

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

function requestFieldPattern(...fieldNames: string[]) {
  const variants = fieldNames.flatMap((fieldName) => [
    fieldName,
    fieldName.replace(/([a-z])([A-Z])/g, "$1_$2"),
    fieldName.replace(/_/g, " "),
    fieldName.replace(/_/g, "-"),
  ]);
  const sources = variants.map((variant) =>
    escapeRegExp(variant).replace(/[_\s-]+/g, "[_\\s-]*"),
  );

  return new RegExp(`"(?:${sources.join("|")})"\\s*:`, "i");
}

function valueTokenPattern(value: string, fallback: RegExp) {
  const match = value.match(fallback);
  return match ? new RegExp(escapeRegExp(match[0]), "i") : fallback;
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

function voiceOutputPromptInput(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("textbox", { name: /^Voice output prompt$/i })
    .or(
      root.getByRole("textbox", {
        name: /voice output prompt|tts prompt|spoken response prompt|assistant prompt|prompt|message|question/i,
      }),
    )
    .or(root.getByPlaceholder(/voice output|tts|spoken response|prompt|message|question|say/i))
    .or(root.locator("textarea"))
    .first();
}

function voiceSelectControl(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("combobox", { name: /^(?:tts |assistant |selected )?voice$|speaker|voice model/i })
    .or(root.getByLabel(/^(?:tts |assistant |selected )?voice$|speaker|voice model/i))
    .or(
      root.locator(
        [
          "select[name*='voice' i]",
          "select[id*='voice' i]",
          "input[name*='voice' i]",
          "input[id*='voice' i]",
          "[data-testid*='voice-select' i]",
          "[data-testid*='voice-control' i]",
        ].join(", "),
      ),
    )
    .first();
}

function voiceOptionGroup(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("group", { name: /^(?:tts |assistant |selected )?voice$|speaker|voice model/i })
    .or(
      root
        .locator(
          [
            "[data-testid*='voice-options' i]",
            "[data-testid*='voice-selector' i]",
            "[class*='voice-options' i]",
            "[class*='voice-selector' i]",
            "[class*='voice-control' i]",
          ].join(", "),
        )
        .filter({ hasText: VOICE_OPTION_PATTERN }),
    )
    .first();
}

function formatSelectControl(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("combobox", {
      name: /^(?:audio |output |selected )?format$|audio format|mime type|file type/i,
    })
    .or(root.getByLabel(/^(?:audio |output |selected )?format$|audio format|mime type|file type/i))
    .or(
      root.locator(
        [
          "select[name*='format' i]",
          "select[id*='format' i]",
          "select[name*='mime' i]",
          "select[id*='mime' i]",
          "input[name*='format' i]",
          "input[id*='format' i]",
          "input[name*='mime' i]",
          "input[id*='mime' i]",
          "[data-testid*='format-select' i]",
          "[data-testid*='format-control' i]",
        ].join(", "),
      ),
    )
    .first();
}

function formatOptionGroup(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("group", {
      name: /^(?:audio |output |selected )?format$|audio format|mime type|file type/i,
    })
    .or(
      root
        .locator(
          [
            "[data-testid*='format-options' i]",
            "[data-testid*='format-selector' i]",
            "[class*='format-options' i]",
            "[class*='format-selector' i]",
            "[class*='format-control' i]",
          ].join(", "),
        )
        .filter({ hasText: FORMAT_OPTION_PATTERN }),
    )
    .first();
}

function actionButton(page: Page, name: RegExp) {
  return workspace(page).getByRole("button", { name }).first();
}

function runVoiceOutputButton(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("button", { name: /^Run voice output$/i })
    .or(root.getByRole("button", { name: /^Generate voice output$/i }))
    .or(root.getByRole("button", { name: /^Generate audio$/i }))
    .or(root.getByRole("button", { name: /^Create audio response$/i }))
    .or(root.getByRole("button", { name: /^Run TTS$/i }))
    .or(
      root.getByRole("button", {
        name: /run voice output|generate voice|generate audio|create audio|text to speech|tts/i,
      }),
    )
    .first();
}

function resetButton(page: Page) {
  return actionButton(page, /^Reset$/i);
}

function audioOutputMedia(panel: Locator) {
  return panel.locator(
    [
      "audio",
      "[data-testid*='audio-player' i]",
      "[data-testid*='audio-preview' i]",
      "[data-testid*='generated-audio' i]",
      "[class*='audio-player' i]",
      "[class*='audio-preview' i]",
      "[class*='generated-audio' i]",
      "[class*='waveform' i]",
    ].join(", "),
  );
}

function audioPlayerControl(panel: Locator) {
  return panel
    .getByRole("button", { name: /play|pause|stop|replay|listen/i })
    .or(
      panel.locator(
        [
          "[aria-label*='play' i]",
          "[aria-label*='pause' i]",
          "[aria-label*='stop' i]",
          "[aria-label*='listen' i]",
          "[data-testid*='play' i]",
          "[data-testid*='pause' i]",
          "[class*='play' i]",
          "[class*='pause' i]",
        ].join(", "),
      ),
    )
    .first();
}

function audioDownloadControl(page: Page) {
  const root = workspace(page);
  return root
    .getByRole("link", { name: /download|save audio|audio file/i })
    .or(root.getByRole("button", { name: /download|save audio|audio file/i }))
    .or(root.locator("a[download], [data-testid*='download' i], [class*='download' i]"))
    .first();
}

function eventCards(panel: Locator) {
  return panel.locator(
    [
      ".event-row",
      ".audio-event",
      ".voice-event",
      ".tts-event",
      ".metadata-event",
      "[class*='event' i]",
      "[class*='audio' i]",
      "[class*='voice' i]",
      "[class*='tts' i]",
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

async function selectExample(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page
    .getByRole("button", {
      name: /28\s+Multimodal Output:\s*Voice(?:\s+(?:implemented|planned))?$/i,
    })
    .click();

  await expect(
    page.getByRole("heading", { name: /^(?:28\s+)?Multimodal Output:\s*Voice$/i }),
  ).toBeVisible();
  await expect(langGraphApiInput(page)).toHaveValue(API_URL);
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(
        /waiting|no .* yet|run .* to .*|empty|not available|appears after .*|pending|generated audio appears after .*|audio output appears after .*/gi,
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

async function readControlValue(locator: Locator) {
  if (!(await isVisible(locator))) return "";

  return normalizeText(
    await locator
      .first()
      .evaluate((element) => {
        if (element instanceof HTMLSelectElement) {
          return element.selectedOptions[0]?.textContent?.trim() || element.value;
        }
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLOptionElement
        ) {
          return element.value;
        }
        return element.textContent ?? "";
      })
      .catch(async () => locator.first().innerText().catch(() => "")),
  );
}

async function selectNativeOption(control: Locator, preferred: RegExp) {
  if (!(await isVisible(control))) return "";

  const tagName = await control
    .first()
    .evaluate((element) => element.tagName.toLowerCase())
    .catch(() => "");
  if (tagName !== "select") return readControlValue(control);

  const options = await control.first().locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      disabled: (node as HTMLOptionElement).disabled,
      label: (node.textContent ?? "").trim(),
      value: (node as HTMLOptionElement).value,
    })),
  );

  const selected =
    options.find((option) => !option.disabled && preferred.test(`${option.label} ${option.value}`)) ??
    options.find((option) => !option.disabled && option.value.trim()) ??
    options.find((option) => !option.disabled);

  if (!selected) return readControlValue(control);

  await control
    .first()
    .selectOption({ value: selected.value })
    .catch(async () => control.first().selectOption({ label: selected.label }));
  return normalizeText(selected.label || selected.value);
}

async function clickPreferredOptionControl(page: Page, pattern: RegExp) {
  const button = workspace(page).getByRole("button", { name: pattern }).first();
  if (await isVisible(button)) {
    if (!(await button.isEnabled().catch(() => false))) return readControlValue(button);

    await button.click();
    return readControlValue(button);
  }

  const radio = workspace(page).getByRole("radio", { name: pattern }).first();
  if (await isVisible(radio)) {
    if (!(await radio.isEnabled().catch(() => false))) return readControlValue(radio);

    await radio.check().catch(async () => radio.click());
    return readControlValue(radio);
  }

  return "";
}

async function configureOutputOptions(page: Page) {
  let selectedVoice = await selectNativeOption(voiceSelectControl(page), VOICE_OPTION_PATTERN);
  if (!selectedVoice.match(VOICE_OPTION_PATTERN)) {
    selectedVoice = await clickPreferredOptionControl(page, VOICE_OPTION_PATTERN);
  }
  if (!selectedVoice.match(VOICE_OPTION_PATTERN)) {
    selectedVoice = await readControlValue(voiceSelectControl(page));
  }

  let selectedFormat = await selectNativeOption(formatSelectControl(page), FORMAT_OPTION_PATTERN);
  if (!selectedFormat.match(FORMAT_OPTION_PATTERN)) {
    selectedFormat = await clickPreferredOptionControl(page, FORMAT_OPTION_PATTERN);
  }
  if (!selectedFormat.match(FORMAT_OPTION_PATTERN)) {
    selectedFormat = await readControlValue(formatSelectControl(page));
  }

  return {
    selectedFormat,
    selectedVoice,
  };
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
  options: { marker: string; selectedFormat: string; selectedVoice: string },
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
  expect(serializedRecords).toContain(options.marker);
  expect(serializedRecords).toMatch(
    requestFieldPattern("selectedVoice", "selected_voice", "ttsVoice", "tts_voice", "voiceId", "voice_id", "voice", "speaker"),
  );
  expect(serializedRecords).toMatch(
    requestFieldPattern(
      "audioFormat",
      "audio_format",
      "selectedFormat",
      "selected_format",
      "outputFormat",
      "output_format",
      "responseFormat",
      "response_format",
      "mimeType",
      "mime_type",
      "format",
    ),
  );

  if (options.selectedVoice.match(VOICE_OPTION_PATTERN)) {
    expect(serializedRecords).toMatch(valueTokenPattern(options.selectedVoice, VOICE_OPTION_PATTERN));
  }
  if (options.selectedFormat.match(FORMAT_OPTION_PATTERN)) {
    expect(serializedRecords).toMatch(valueTokenPattern(options.selectedFormat, FORMAT_OPTION_PATTERN));
  }
}

async function assertVoiceControlAvailable(page: Page) {
  await expect
    .poll(
      async () => {
        if (await isVisible(voiceSelectControl(page))) return 1;
        if (await isVisible(voiceOptionGroup(page))) return 1;
        return (await isVisible(workspace(page).getByRole("button", { name: VOICE_OPTION_PATTERN }).first()))
          ? 1
          : 0;
      },
      { timeout: 10_000 },
    )
    .toBe(1);
}

async function assertFormatControlAvailable(page: Page) {
  await expect
    .poll(
      async () => {
        if (await isVisible(formatSelectControl(page))) return 1;
        if (await isVisible(formatOptionGroup(page))) return 1;
        return (await isVisible(workspace(page).getByRole("button", { name: FORMAT_OPTION_PATTERN }).first()))
          ? 1
          : 0;
      },
      { timeout: 10_000 },
    )
    .toBe(1);
}

async function assertInitialSurface(page: Page) {
  await expect(langGraphApiInput(page)).toBeVisible();
  await expect(voiceOutputPromptInput(page)).toBeVisible();
  await assertVoiceControlAvailable(page);
  await assertFormatControlAvailable(page);
  await expect(runVoiceOutputButton(page)).toBeVisible();
  await expect(resetButton(page)).toBeVisible();

  const panelGroups = [
    [/generated text/i, /assistant text/i, /text response/i, /spoken text/i, /voice response/i],
    [/audio output/i, /audio preview/i, /audio player/i, /generated audio/i, /voice output audio/i],
    [/audio metadata/i, /output metadata/i, /voice metadata/i, /tts metadata/i],
    [/final state/i],
    [/raw stream events/i],
  ];

  for (const names of panelGroups) {
    await expect(await panelByAnyName(page, names)).toBeVisible();
  }
}

async function assertGeneratedText(page: Page) {
  const panel = await panelByAnyName(page, [
    /generated text/i,
    /assistant text/i,
    /text response/i,
    /spoken text/i,
    /voice response/i,
  ]);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /generated text|assistant text|text response|spoken text|voice response/i,
    /[A-Za-z][\s\S]{12,}/,
    120_000,
  );
  await expect(panel).not.toContainText(/no generated text yet|no response yet|waiting/i);
}

async function assertAudioOutput(page: Page) {
  const panel = await panelByAnyName(page, [
    /audio output/i,
    /audio preview/i,
    /audio player/i,
    /generated audio/i,
    /voice output audio/i,
  ]);
  await expect(panel).toBeVisible();
  await expect
    .poll(
      async () => {
        const media = audioOutputMedia(panel);
        const count = await media.count();
        for (let index = 0; index < count; index += 1) {
          if (await media.nth(index).isVisible().catch(() => false)) return 1;
        }

        if (await isVisible(audioPlayerControl(panel))) return 1;

        const body = await panelBodyText(
          panel,
          /audio output|audio preview|audio player|generated audio|voice output audio/i,
        );
        return /audio (?:player|preview)|play|pause|listen|generated audio|blob|data:audio|mp3|mpeg|wav|webm|ogg|opus/i.test(
          body,
        )
          ? 1
          : 0;
      },
      { timeout: 120_000 },
    )
    .toBe(1);
}

async function assertAudioMetadata(
  page: Page,
  options: { selectedFormat: string; selectedVoice: string },
) {
  const panel = await panelByAnyName(page, [
    /audio metadata/i,
    /output metadata/i,
    /voice metadata/i,
    /tts metadata/i,
  ]);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /audio metadata|output metadata|voice metadata|tts metadata/i,
    /audio|voice|speaker|tts|format|mime|mp3|mpeg|wav|webm|ogg|opus|file|size|bytes|duration|seconds|source|url|download/i,
    90_000,
  );

  await expect(panel).toContainText(/voice|speaker|tts/i);
  await expect(panel).toContainText(/format|mime|mp3|mpeg|wav|webm|ogg|opus|audio\//i);
  await expect(panel).toContainText(/download|url|href|file|size|bytes|duration|seconds|source|blob|data:audio/i);

  if (options.selectedVoice.match(VOICE_OPTION_PATTERN)) {
    await expect(panel).toContainText(valueTokenPattern(options.selectedVoice, VOICE_OPTION_PATTERN));
  }
  if (options.selectedFormat.match(FORMAT_OPTION_PATTERN)) {
    await expect(panel).toContainText(valueTokenPattern(options.selectedFormat, FORMAT_OPTION_PATTERN));
  }
}

async function assertAudioDownload(page: Page) {
  const download = audioDownloadControl(page);
  await expect(download).toBeVisible({ timeout: 90_000 });

  const metadataText =
    (await download.innerText().catch(() => "")) ||
    (await download.getAttribute("aria-label").catch(() => "")) ||
    (await download.getAttribute("title").catch(() => "")) ||
    (await download.getAttribute("download").catch(() => "")) ||
    (await download.getAttribute("href").catch(() => ""));
  expect(metadataText).toMatch(/download|audio|mp3|mpeg|wav|webm|ogg|opus|blob:|data:audio|\.mp3|\.wav/i);
}

async function assertFinalState(
  page: Page,
  options: { marker: string; selectedFormat: string; selectedVoice: string },
) {
  const panel = await namedPanel(page, /final state/i);
  await expect(panel).toBeVisible();
  await waitForPanelText(
    panel,
    /final state/i,
    /audio|voice|tts|generated|text|metadata|format|mime|download|final_status|final/i,
    90_000,
  );

  await expect(panel).toContainText(options.marker);

  for (const pattern of [
    fieldPattern(
      "generated_text",
      "generatedText",
      "assistant_text",
      "assistantText",
      "text_response",
      "textResponse",
      "generated_response",
      "generatedResponse",
      "text_answer",
      "textAnswer",
      "response",
      "answer",
    ),
    fieldPattern("audio_metadata", "audioMetadata", "audio_output", "audioOutput", "audio_url", "audioUrl", "generated_audio", "generatedAudio", "audio"),
    fieldPattern("selected_voice", "selectedVoice", "tts_voice", "ttsVoice", "voice"),
    fieldPattern("audio_format", "audioFormat", "selected_format", "selectedFormat", "mime_type", "mimeType", "format"),
    fieldPattern("final_status", "finalStatus", "final status"),
  ]) {
    await expect(panel).toContainText(pattern);
  }

  if (options.selectedVoice.match(VOICE_OPTION_PATTERN)) {
    await expect(panel).toContainText(valueTokenPattern(options.selectedVoice, VOICE_OPTION_PATTERN));
  }
  if (options.selectedFormat.match(FORMAT_OPTION_PATTERN)) {
    await expect(panel).toContainText(valueTokenPattern(options.selectedFormat, FORMAT_OPTION_PATTERN));
  }
}

async function assertRawStreamEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(eventCards(panel).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText(/\bupdates?\b/i);
  await expect(panel).toContainText(/\bcustom\b/i);
  await expect(panel).toContainText(/audio|voice|tts|generated|text|metadata|format|download|final/i);
}

test("Multimodal Output: Voice exposes the expected controls and panels", async ({ page }) => {
  await selectExample(page);
  await assertInitialSurface(page);
});

test("Multimodal Output: Voice streams generated text and audio metadata", async ({
  page,
}, testInfo) => {
  await selectExample(page);
  await assertInitialSurface(page);

  const uniqueId = `${Date.now()}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
  const marker = `E2E multimodal voice output marker ${uniqueId}`;
  const { selectedFormat, selectedVoice } = await configureOutputOptions(page);

  const seededPrompt = await voiceOutputPromptInput(page).inputValue();
  await voiceOutputPromptInput(page).fill(
    `${seededPrompt}\n\n${marker}: produce a concise spoken response, include generated text, selected voice metadata, selected audio format metadata, downloadable audio, and final_status.`,
  );

  const streamRequests = watchStreamRequests(page);
  await runVoiceOutputButton(page).click();

  await assertGeneratedText(page);
  await assertAudioOutput(page);
  await assertAudioMetadata(page, { selectedFormat, selectedVoice });
  await assertAudioDownload(page);
  await assertFinalState(page, { marker, selectedFormat, selectedVoice });
  await assertRawStreamEvents(page);

  streamRequests.stop();
  assertStreamRequestBodies(streamRequests.records, { marker, selectedFormat, selectedVoice });
});
