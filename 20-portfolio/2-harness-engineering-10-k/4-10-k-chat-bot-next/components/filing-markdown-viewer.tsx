"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";
import { Response } from "./elements/response";
import { Input } from "./ui/input";

type DocumentRecord = {
  id: string;
  title: string;
  content: string | null;
};

type Section = {
  itemCode: string;
  title: string;
  content: string;
};

type TocItem = {
  itemCode: string;
  title: string;
};

type SearchSnippet = {
  id: string;
  text: string;
};

function parseMarkdownSections(markdown: string): Section[] {
  const pattern = /^##\s+Item\s+([0-9]{1,2}[A-Za-z]?)\s*-?\s*(.*)$/gim;
  const matches: Array<{ index: number; itemCode: string; title: string }> = [];

  for (const match of markdown.matchAll(pattern)) {
    matches.push({
      index: match.index ?? 0,
      itemCode: (match[1] ?? "").toUpperCase(),
      title: (match[2] ?? "").trim(),
    });
  }

  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = match.index;
    const end = next?.index ?? markdown.length;

    return {
      itemCode: match.itemCode,
      title: match.title,
      content: markdown.slice(start, end).trim(),
    };
  });
}

function getSearchSnippets(content: string, query: string): SearchSnippet[] {
  if (!query.trim()) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const snippets: SearchSnippet[] = [];

  let cursor = 0;
  while (cursor < content.length && snippets.length < 8) {
    const index = content.toLowerCase().indexOf(normalizedQuery, cursor);
    if (index < 0) {
      break;
    }

    const start = Math.max(0, index - 80);
    const end = Math.min(content.length, index + normalizedQuery.length + 80);
    snippets.push({
      id: `${index}-${end}`,
      text: content.slice(start, end).replaceAll(/\s+/g, " "),
    });

    cursor = index + normalizedQuery.length;
  }

  return snippets;
}

function getHighlightedParts(snippet: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [{ highlighted: false, start: 0, text: snippet }];
  }

  const parts: Array<{ highlighted: boolean; start: number; text: string }> =
    [];
  const lowerSnippet = snippet.toLowerCase();
  let cursor = 0;

  while (cursor < snippet.length) {
    const start = lowerSnippet.indexOf(normalizedQuery, cursor);
    if (start < 0) {
      parts.push({
        highlighted: false,
        start: cursor,
        text: snippet.slice(cursor),
      });
      break;
    }

    if (start > cursor) {
      parts.push({
        highlighted: false,
        start: cursor,
        text: snippet.slice(cursor, start),
      });
    }

    const end = start + normalizedQuery.length;
    parts.push({
      highlighted: true,
      start,
      text: snippet.slice(start, end),
    });
    cursor = end;
  }

  return parts.filter((part) => part.text.length > 0);
}

export function FilingMarkdownViewer({
  documentId,
  toc,
}: {
  documentId: string;
  toc: TocItem[];
}) {
  const { data: documents, isLoading } = useSWR<DocumentRecord[]>(
    `/api/document?id=${documentId}`,
    fetcher
  );
  const [query, setQuery] = useState("");
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);

  const content = documents?.at(-1)?.content ?? "";

  const sections = useMemo(() => parseMarkdownSections(content), [content]);

  const sectionsByCode = useMemo(
    () => new Map(sections.map((section) => [section.itemCode, section])),
    [sections]
  );

  const selectedSection = selectedItemCode
    ? sectionsByCode.get(selectedItemCode)
    : null;

  const renderedMarkdown = selectedSection?.content || content;

  const snippets = useMemo(
    () => getSearchSnippets(renderedMarkdown, query),
    [renderedMarkdown, query]
  );

  const hasToc = toc.length > 0 || sections.length > 0;
  const tocItems =
    toc.length > 0
      ? toc
      : sections.map((section) => ({
          itemCode: section.itemCode,
          title: section.title,
        }));

  return (
    <div className="mt-2 space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">
          Filing Reader
        </div>
        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search in selected section"
          value={query}
        />
      </div>

      {hasToc && (
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border px-2 py-1 text-xs hover:bg-muted"
            onClick={() => setSelectedItemCode(null)}
            type="button"
          >
            All
          </button>
          {tocItems.map((item) => (
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-muted"
              key={`${item.itemCode}-${item.title}`}
              onClick={() => setSelectedItemCode(item.itemCode)}
              type="button"
            >
              Item {item.itemCode}
            </button>
          ))}
        </div>
      )}

      {snippets.length > 0 && (
        <div className="space-y-1 rounded border bg-background p-2">
          <div className="font-medium text-xs">Search Highlights</div>
          {snippets.map((snippet) => (
            <div className="text-[11px] text-muted-foreground" key={snippet.id}>
              ...
              {getHighlightedParts(snippet.text, query).map((part) =>
                part.highlighted ? (
                  <mark key={`${part.start}-mark`}>{part.text}</mark>
                ) : (
                  <span key={`${part.start}-text`}>{part.text}</span>
                )
              )}
              ...
            </div>
          ))}
        </div>
      )}

      <div className="max-h-[520px] overflow-auto rounded border bg-background p-3">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading filing...</div>
        ) : (
          <Response className="prose prose-sm max-w-none">
            {renderedMarkdown}
          </Response>
        )}
      </div>
    </div>
  );
}
