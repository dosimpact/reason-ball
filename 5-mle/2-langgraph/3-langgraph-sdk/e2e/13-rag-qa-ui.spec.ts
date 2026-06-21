import { expect, Locator, Page, test } from "@playwright/test";

test.setTimeout(120_000);

const citationPattern = /\[(doc-[A-Za-z0-9_-]+)\]/;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

async function selectExample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /13 RAG\s*\/\s*QA UI/i }).click();

  await expect(page.getByRole("heading", { name: /RAG\s*\/\s*QA UI/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /api url|langgraph api url/i })).toHaveValue(
    "http://localhost:2931",
  );
}

function workspace(page: Page) {
  return page.getByRole("main").or(page.locator("main")).first();
}

function questionInput(page: Page) {
  return workspace(page)
    .getByRole("textbox", { name: /question|ask|prompt|input|query/i })
    .or(workspace(page).getByPlaceholder(/question|ask|prompt|query/i))
    .first();
}

function sampleButtons(page: Page) {
  return workspace(page)
    .getByRole("button", {
      name: /sample|question|rag|retrieval|citation|langgraph|sdk|document|evidence/i,
    })
    .filter({ hasNotText: /run|reset|clear/i });
}

function runButton(page: Page) {
  return workspace(page)
    .getByRole("button", { name: /run\s+rag\s+qa|run\s+qa|ask\s+rag|answer\s+question/i })
    .first();
}

async function panelBodyText(panel: Locator, title: RegExp) {
  return normalizeText(
    (await panel.innerText())
      .replace(title, "")
      .replace(/waiting|no .* yet|run .* to .*|empty|not available/gi, ""),
  );
}

async function waitForPanelBodyText(panel: Locator, title: RegExp, timeout = 20_000) {
  await expect.poll(async () => panelBodyText(panel, title), { timeout }).not.toBe("");
  return panelBodyText(panel, title);
}

function retrievedDocumentCards(panel: Locator) {
  return panel
    .locator(
      ".document-card, .retrieved-document, [data-testid*='document' i], [data-testid*='retrieved-doc' i], [data-source-id], article, li, details",
    )
    .filter({ hasText: /rank|score|source|snippet|doc-|document/i });
}

function citationChips(page: Page) {
  return page
    .getByRole("button", { name: citationPattern })
    .or(page.getByRole("link", { name: citationPattern }))
    .or(
      page
        .locator(".citation-chip, [data-testid*='citation' i], [class*='citation' i]")
        .filter({ hasText: citationPattern }),
    )
    .or(page.locator("button, a").filter({ hasText: citationPattern }));
}

function sourceIdFromCitation(text: string) {
  const match = text.match(citationPattern) ?? text.match(/\b(doc-[A-Za-z0-9_-]+)\b/);
  if (!match) {
    throw new Error(`Expected citation text to include a source id, received: ${text}`);
  }
  return match[1];
}

function documentCardForSource(documentsPanel: Locator, sourceId: string) {
  const escapedSourceId = escapeRegExp(sourceId);
  const quotedSourceId = cssString(sourceId);

  return documentsPanel
    .locator(`[data-source-id="${quotedSourceId}"], [data-testid*="${quotedSourceId}" i]`)
    .or(retrievedDocumentCards(documentsPanel).filter({ hasText: new RegExp(escapedSourceId, "i") }))
    .first();
}

async function isFocusedOrHighlighted(card: Locator) {
  return card.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    const className =
      typeof htmlElement.className === "string" ? htmlElement.className : String(htmlElement.className);
    const activeElement = document.activeElement;
    const markerAttributes = [
      "aria-current",
      "aria-selected",
      "data-active",
      "data-selected",
      "data-highlighted",
      "data-focused",
    ];

    return (
      htmlElement === activeElement ||
      htmlElement.contains(activeElement) ||
      markerAttributes.some((attribute) => {
        const value = htmlElement.getAttribute(attribute);
        return value === "true" || value === "page" || value === "";
      }) ||
      /\b(active|selected|highlight|highlighted|focused|focus-target|target)\b/i.test(className)
    );
  });
}

async function assertRetrievedDocuments(panel: Locator) {
  const fallback = panel
    .getByText(/no documents?|no relevant|no useful|no matches|nothing retrieved|fallback/i)
    .first();

  if ((await fallback.count()) > 0 && (await fallback.isVisible())) {
    await expect(fallback).toBeVisible();
    await expect(panel).toContainText(/fallback|no documents?|no relevant|no useful|no matches/i);
    return retrievedDocumentCards(panel);
  }

  const cards = retrievedDocumentCards(panel);
  await expect.poll(async () => cards.count(), { timeout: 20_000 }).toBeGreaterThan(0);

  const firstCard = cards.first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard).toContainText(/rank\s*[:#]?\s*\d+|#\s*\d+|\brank\b/i);
  await expect(firstCard).toContainText(/score\s*[:#]?\s*[0-9.]+|similarity|relevance/i);
  await expect(firstCard).toContainText(/source(\s*id)?|doc-rag|doc-sdk|doc-/i);
  await expect(firstCard).toContainText(/snippet|excerpt|content|LangGraph|SDK|retrieval|citation/i);

  return cards;
}

async function populatedRawEvents(page: Page) {
  const panel = await namedPanel(page, /raw stream events/i);
  await expect(panel).toBeVisible();
  await expect(
    panel.locator(".event-row, details, pre, code, li, [data-testid*='event' i]").first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(panel).toContainText(/updates?|values?|payload|state/i);
  await expect(panel).toContainText(/retriev|document|citation|answer|final|fallback/i);
  return panel;
}

test("RAG / QA UI renders cited answer and links citations to retrieved documents", async ({
  page,
}) => {
  await selectExample(page);

  const question = questionInput(page);
  await expect(question).toBeVisible();
  await expect(question).not.toHaveValue("");

  await expect(sampleButtons(page).first()).toBeVisible();

  await runButton(page).click();

  await expect(page.getByText(/^Run complete$/i)).toBeVisible({ timeout: 90_000 });

  const retrievalStatus = await namedPanel(page, /retrieval status/i);
  await expect(retrievalStatus).toBeVisible();
  await expect(retrievalStatus).toContainText(/retriev|search|query|documents?|complete|done|score|matches/i);

  const answer = await namedPanel(page, /answer/i);
  await expect(answer).toBeVisible();
  const answerText = await waitForPanelBodyText(answer, /answer/i, 30_000);
  expect(answerText.length).toBeGreaterThan(30);
  expect(answerText).toMatch(citationPattern);

  const documents = await namedPanel(page, /retrieved documents/i);
  await expect(documents).toBeVisible();
  const documentCards = await assertRetrievedDocuments(documents);
  await expect.poll(async () => documentCards.count(), { timeout: 20_000 }).toBeGreaterThan(0);

  const citationTrail = await namedPanel(page, /citation trail|citations/i);
  await expect(citationTrail).toBeVisible();
  await expect(citationTrail).toContainText(citationPattern);

  const chip = citationChips(page).first();
  await expect(chip).toBeVisible();
  const sourceId = sourceIdFromCitation(normalizeText(await chip.innerText()));
  const matchingCard = documentCardForSource(documents, sourceId);

  await chip.click();

  await expect(matchingCard).toBeVisible();
  await expect(matchingCard).toContainText(new RegExp(escapeRegExp(sourceId), "i"));
  await expect.poll(async () => isFocusedOrHighlighted(matchingCard), { timeout: 5_000 }).toBe(true);

  const finalState = await namedPanel(page, /final state/i);
  await expect(finalState).toBeVisible();
  await waitForPanelBodyText(finalState, /final state/i);
  await expect(finalState).toContainText(/question|retrieved_docs|retrieved docs|documents?|answer/i);
  await expect(finalState).toContainText(/citation|citation_ok|qa_status|doc-rag|doc-sdk|doc-/i);

  await populatedRawEvents(page);
});
