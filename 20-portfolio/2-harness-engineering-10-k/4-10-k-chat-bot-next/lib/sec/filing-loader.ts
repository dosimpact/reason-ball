/**
 * Filing document loader and normalizer.
 *
 * Converts collector-downloaded local files (txt/html) into:
 * - normalized plain text
 * - Item-based section slices
 * - markdown/toc payload for reader and downstream summarizers
 */
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ChatSDKError } from "@/lib/errors";
import type { FilingRecord, ItemSection, ReaderTocItem } from "./types";

const KEY_ITEM_CODES = ["1", "1A", "7", "8"] as const;
const DEFAULT_ITEM_TITLE: Record<string, string> = {
  "1": "Business",
  "1A": "Risk Factors",
  "2": "Properties",
  "3": "Legal Proceedings",
  "7": "MD&A",
  "8": "Financial Statements",
};

const ITEM_REGEX =
  /(?:^|\n)\s*item\s+([0-9]{1,2}[a-zA-Z]?)\s*[.:\-)]?\s*([^\n]{0,120})/gi;

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll(/&nbsp;/gi, " ")
    .replaceAll(/&amp;/gi, "&")
    .replaceAll(/&lt;/gi, "<")
    .replaceAll(/&gt;/gi, ">")
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'");
}

function normalizeText(input: string): string {
  return input
    .replaceAll(/\r\n?/g, "\n")
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .replaceAll(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToText(html: string): string {
  const withoutScripts = html
    .replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replaceAll(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  const withLineBreaks = withoutScripts
    .replaceAll(/<\s*br\s*\/?>/gi, "\n")
    .replaceAll(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replaceAll(/<\s*\/\s*div\s*>/gi, "\n")
    .replaceAll(/<\s*\/\s*li\s*>/gi, "\n")
    .replaceAll(/<\s*\/\s*tr\s*>/gi, "\n")
    .replaceAll(/<\s*h[1-6][^>]*>/gi, "\n")
    .replaceAll(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n");

  const withoutTags = withLineBreaks.replaceAll(/<[^>]+>/g, " ");

  return normalizeText(decodeHtmlEntities(withoutTags));
}

function toItemCode(rawCode: string) {
  return rawCode.trim().toUpperCase();
}

function sanitizeSectionContent(content: string): string {
  return normalizeText(content).replaceAll(/\n{3,}/g, "\n\n");
}

export function extractItemSections(normalizedText: string): ItemSection[] {
  const matches: Array<{ index: number; itemCode: string; title: string }> = [];

  for (const match of normalizedText.matchAll(ITEM_REGEX)) {
    const itemCode = toItemCode(match[1] ?? "");

    if (!itemCode) {
      continue;
    }

    matches.push({
      index: match.index ?? 0,
      itemCode,
      title: (match[2] ?? "").trim(),
    });
  }

  if (matches.length === 0) {
    return [];
  }

  const candidatesByItemCode = new Map<string, ItemSection>();

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];

    const start = current.index;
    const end = next?.index ?? normalizedText.length;

    if (end <= start) {
      continue;
    }

    const content = sanitizeSectionContent(normalizedText.slice(start, end));

    if (content.length < 280) {
      continue;
    }

    const section: ItemSection = {
      itemCode: current.itemCode,
      title: current.title || DEFAULT_ITEM_TITLE[current.itemCode] || "",
      content,
      start,
      end,
    };

    const existing = candidatesByItemCode.get(current.itemCode);

    if (!existing || section.content.length > existing.content.length) {
      candidatesByItemCode.set(current.itemCode, section);
    }
  }

  return Array.from(candidatesByItemCode.values()).sort(
    (a, b) => a.start - b.start
  );
}

export function createFilingMarkdown({
  filing,
  sections,
  normalizedText,
}: {
  filing: FilingRecord;
  sections: ItemSection[];
  normalizedText: string;
}) {
  const header = [
    `# ${filing.companyName} ${filing.formType} (${filing.filingDate ?? "date unknown"})`,
    "",
    `- Ticker: ${filing.ticker ?? "N/A"}`,
    `- CIK: ${filing.cik}`,
    `- Accession: ${filing.accessionNo}`,
    `- Filing URL: ${filing.filingUrl}`,
    "",
  ].join("\n");

  if (sections.length === 0) {
    return `${header}\n## Full Text\n\n${normalizedText}`;
  }

  const body = sections
    .map((section) => {
      const titleSuffix = section.title ? ` - ${section.title}` : "";
      return `## Item ${section.itemCode}${titleSuffix}\n\n${section.content}`;
    })
    .join("\n\n");

  return `${header}${body}`;
}

function resolveCollectorDataDir() {
  if (process.env.COLLECTOR_DATA_DIR) {
    return process.env.COLLECTOR_DATA_DIR;
  }

  return path.resolve(process.cwd(), "../2-10-k-collector/data");
}

function resolveLocalFilePath(filePath: string | null) {
  if (!filePath) {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const collectorDataDir = resolveCollectorDataDir();

  if (filePath.startsWith("data/")) {
    return path.join(collectorDataDir, filePath.slice("data/".length));
  }

  return path.join(collectorDataDir, filePath);
}

export async function loadFilingDocument({
  filing,
}: {
  filing: FilingRecord;
}): Promise<{
  rawText: string;
  normalizedText: string;
  sections: ItemSection[];
  markdown: string;
  toc: ReaderTocItem[];
  keyItems: ReaderTocItem[];
}> {
  // Resolve file path from collector metadata, then parse to normalized structures.
  const resolvedFilePath = resolveLocalFilePath(filing.filePath);

  if (!resolvedFilePath) {
    throw new ChatSDKError(
      "bad_request:api",
      `No local file path for accession ${filing.accessionNo}`
    );
  }

  let source = "";

  try {
    source = await readFile(resolvedFilePath, "utf-8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ChatSDKError(
      "bad_request:api",
      `Failed to read filing file at ${resolvedFilePath}: ${reason}`
    );
  }

  const isLikelyHtml =
    resolvedFilePath.toLowerCase().endsWith(".html") ||
    resolvedFilePath.toLowerCase().endsWith(".htm") ||
    /<html|<body|<div|<table/i.test(source);

  const rawText = isLikelyHtml ? htmlToText(source) : normalizeText(source);

  const normalizedText = normalizeText(rawText);
  const sections = extractItemSections(normalizedText);
  const markdown = createFilingMarkdown({ filing, sections, normalizedText });

  const toc = sections.map((section) => ({
    itemCode: section.itemCode,
    title: section.title || DEFAULT_ITEM_TITLE[section.itemCode] || "",
  }));

  const keyItems = toc.filter((item) =>
    KEY_ITEM_CODES.includes(item.itemCode as (typeof KEY_ITEM_CODES)[number])
  );

  return {
    rawText,
    normalizedText,
    sections,
    markdown,
    toc,
    keyItems,
  };
}

export function getPriorityItemOrder() {
  return ["1", "1A", "7", "8", "3", "2"];
}

export function pickPrioritySections(sections: ItemSection[]) {
  const order = getPriorityItemOrder();
  const sectionMap = new Map(
    sections.map((section) => [section.itemCode, section])
  );

  return order
    .map((itemCode) => sectionMap.get(itemCode))
    .filter(Boolean) as ItemSection[];
}
