/**
 * Local SEC fallback for development/offline conditions.
 *
 * When AI Gateway is unavailable in dev, this module detects SEC intent,
 * runs repository/loader/summarizer directly, and writes synthetic tool events
 * so the UI still shows a tool-driven conversation flow.
 */
import "server-only";

import type { UIMessageStreamWriter } from "ai";
import {
  hasUsableAiGatewayKey,
  isDevelopmentEnvironment,
} from "@/lib/constants";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { buildInvestmentDecisionBriefFromFiling } from "@/lib/sec/investment-brief";
import { listCompanyFilings } from "@/lib/sec/repository";
import { summarizeFilingByStyle } from "@/lib/sec/summarizer";
import type {
  FilingRecord,
  FilingSummary,
  ReasoningTrace,
} from "@/lib/sec/types";
import type { ChatMessage } from "@/lib/types";

type LocalFallbackIntent = "list" | "summary" | "brief" | "full-text";

const FORM_REGEX = /\b(10-K|10-Q|20-F|6-K)\b/gi;
const CIK_REGEX = /\b\d{10}\b/;
const WORD_REGEX = /[A-Za-z]{2,12}/g;
const SEC_INTENT_REGEX =
  /10-?k|10-?q|20-?f|6-?k|filings?|공시|보고|보고서|사업보고서|사업|요약|summary|브리프|brief|투자/i;
const EXCLUDED_WORDS = new Set([
  "SHOW",
  "LIST",
  "LATEST",
  "RECENT",
  "PLEASE",
  "SUMMARY",
  "BRIEF",
  "SEC",
  "FILING",
  "FILINGS",
  "FORM",
  "ITEM",
]);

function shouldEnableLocalFallback() {
  if (!isDevelopmentEnvironment) {
    return false;
  }

  return !hasUsableAiGatewayKey();
}

function getUserTextHistory(messages: ChatMessage[]) {
  const history: string[] = [];

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts
      .map((part) => {
        if (!part || typeof part !== "object" || !("type" in part)) {
          return "";
        }

        if ((part as { type?: string }).type !== "text") {
          return "";
        }

        const candidate = (part as { text?: unknown }).text;
        return typeof candidate === "string" ? candidate : "";
      })
      .join(" ")
      .trim();

    if (text) {
      history.push(text);
    }
  }

  return history;
}

function inferIntent(input: string): LocalFallbackIntent | null {
  const text = input.toLowerCase();

  if (/브리프|brief|투자판단|investment/.test(text)) {
    return "brief";
  }

  if (/요약|summary|핵심/.test(text)) {
    return "summary";
  }

  if (/원문|전문|full\s*text|본문/.test(text)) {
    return "full-text";
  }

  if (/목록|list|filings?|10-?k|10-?q|20-?f|6-?k/.test(text)) {
    return "list";
  }

  return null;
}

function extractCompanyQueryFromText(text: string) {
  const cik = text.match(CIK_REGEX)?.[0];
  if (cik) {
    return cik;
  }

  const stripped = text.replace(FORM_REGEX, " ");
  const words = stripped.match(WORD_REGEX) ?? [];

  for (const rawWord of words) {
    const upper = rawWord.toUpperCase();

    if (EXCLUDED_WORDS.has(upper)) {
      continue;
    }

    if (upper.length < 2) {
      continue;
    }

    return rawWord;
  }

  return null;
}

function inferCompanyQuery(history: string[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const query = extractCompanyQueryFromText(history[index] ?? "");
    if (query) {
      return query;
    }
  }

  return null;
}

function pickBestFiling(filings: FilingRecord[]) {
  return (
    filings.find(
      (filing) =>
        filing.status === "downloaded" &&
        Boolean(filing.filePath) &&
        (filing.formType === "10-K" || filing.formType === "20-F")
    ) ??
    filings.find(
      (filing) => filing.status === "downloaded" && Boolean(filing.filePath)
    ) ??
    filings[0] ??
    null
  );
}

function writeToolResult({
  writer,
  toolCallId,
  toolName,
  input,
  output,
}: {
  writer: UIMessageStreamWriter<ChatMessage>;
  toolCallId: string;
  toolName:
    | "listCompanyFilings"
    | "openLatestFilingFullText"
    | "summarizeSelectedFiling"
    | "buildInvestmentDecisionBrief";
  input: unknown;
  output: unknown;
}) {
  writer.write({
    type: "tool-input-available",
    toolCallId,
    toolName,
    input,
  });
  writer.write({
    type: "tool-output-available",
    toolCallId,
    output,
  });
}

function formatFilingListText(filings: FilingRecord[]) {
  const lines = filings.slice(0, 5).map((filing) => {
    return `- ${filing.formType} | ${filing.filingDate ?? "unknown"} | ${filing.accessionNo}`;
  });

  return lines.join("\n");
}

function formatSummaryText({
  filing,
  summary,
}: {
  filing: FilingRecord;
  summary: FilingSummary;
}) {
  const bullets = summary.keyBullets.slice(0, 3).map((bullet) => `- ${bullet}`);

  return [
    `${filing.companyName} ${filing.formType} (${filing.filingDate ?? "unknown"}) 요약입니다.`,
    `핵심 한줄: ${summary.oneLiner}`,
    ...bullets,
  ].join("\n");
}

function formatBriefText({
  filing,
  brief,
}: {
  filing: FilingRecord;
  brief: {
    stance: string;
    conclusion: string;
    nextChecks: string[];
  };
}) {
  const checks = brief.nextChecks.slice(0, 3).map((check) => `- ${check}`);

  return [
    `${filing.companyName} ${filing.formType} 투자판단 브리프입니다.`,
    `Stance: ${brief.stance}`,
    `결론: ${brief.conclusion}`,
    "다음 확인 항목:",
    ...checks,
  ].join("\n");
}

function formatFullTextPreview({
  filing,
  markdown,
}: {
  filing: FilingRecord;
  markdown: string;
}) {
  const preview = markdown.slice(0, 900);

  return [
    `${filing.companyName} ${filing.formType} 원문 프리뷰입니다.`,
    preview,
  ].join("\n\n");
}

function writeAssistantMessage({
  writer,
  text,
}: {
  writer: UIMessageStreamWriter<ChatMessage>;
  text: string;
}) {
  writer.write({ type: "text-start", id: "local-fallback-text" });
  writer.write({
    type: "text-delta",
    id: "local-fallback-text",
    delta: text,
  });
  writer.write({ type: "text-end", id: "local-fallback-text" });
}

function buildTraceFromToolLog(toolLog: string[]): ReasoningTrace {
  return {
    selectedOrder: ["latest_filing", "local_fallback"],
    steps: [
      {
        title: "Gateway fallback",
        detail:
          "AI Gateway key is unavailable in development, local SEC fallback path was used.",
        status: "used",
      },
    ],
    toolLog,
    uncertainties: [],
  };
}

export async function maybeRunLocalSecChatFallback({
  writer,
  messages,
}: {
  writer: UIMessageStreamWriter<ChatMessage>;
  messages: ChatMessage[];
}) {
  if (!shouldEnableLocalFallback()) {
    return false;
  }

  const history = getUserTextHistory(messages);
  const latestInput = history.at(-1) ?? "";

  if (!latestInput || !SEC_INTENT_REGEX.test(latestInput)) {
    return false;
  }

  const intent = inferIntent(latestInput);
  if (!intent) {
    return false;
  }

  writer.write({ type: "start" });

  try {
    const companyQuery = inferCompanyQuery(history);

    if (!companyQuery) {
      writeAssistantMessage({
        writer,
        text: "회사명(또는 티커/CIK)을 먼저 알려주시면 해당 공시를 즉시 찾아드릴 수 있어요. 예: AAPL, Apple, 0000320193",
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    const filingListResult = await listCompanyFilings({
      companyQuery,
      limit: 10,
      cursor: 0,
      forms: ["10-K", "10-Q", "20-F", "6-K"],
    });

    if (!filingListResult || filingListResult.filings.length === 0) {
      writeAssistantMessage({
        writer,
        text: `회사(${companyQuery})에 대한 공시 데이터를 찾지 못했습니다. 회사명/티커/CIK로 다시 요청해 주세요.`,
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    writeToolResult({
      writer,
      toolCallId: "local-list-filings",
      toolName: "listCompanyFilings",
      input: {
        companyQuery,
        forms: ["10-K", "10-Q", "20-F", "6-K"],
        limit: 10,
        cursor: 0,
      },
      output: {
        company: filingListResult.company,
        filings: filingListResult.filings,
        pagination: {
          cursor: 0,
          nextCursor: filingListResult.nextCursor,
          hasMore: filingListResult.hasMore,
        },
        reasoningTrace: buildTraceFromToolLog([
          "Queried companies table",
          "Queried filings table ordered by filing date",
          "Applied local SEC fallback path in development",
        ]),
      },
    });

    const selectedFiling = pickBestFiling(filingListResult.filings);

    if (!selectedFiling) {
      writeAssistantMessage({
        writer,
        text: `${filingListResult.company.name} 기준 공시 목록을 불러왔지만 분석 가능한 파일을 선택하지 못했습니다.`,
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    if (intent === "list") {
      writeAssistantMessage({
        writer,
        text: [
          `${filingListResult.company.name} (${filingListResult.company.ticker ?? "N/A"}) 최근 공시 목록입니다.`,
          formatFilingListText(filingListResult.filings),
          `대표 선택 공시: ${selectedFiling.formType} ${selectedFiling.accessionNo}`,
        ].join("\n"),
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    if (!(selectedFiling.status === "downloaded" && selectedFiling.filePath)) {
      writeAssistantMessage({
        writer,
        text: `${selectedFiling.accessionNo} 공시는 아직 다운로드되지 않아 상세 분석을 진행할 수 없습니다.`,
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    const document = await loadFilingDocument({ filing: selectedFiling });

    if (intent === "full-text") {
      writeToolResult({
        writer,
        toolCallId: "local-open-full-text",
        toolName: "openLatestFilingFullText",
        input: {
          companyQuery,
          targetPeriod: "auto",
        },
        output: {
          filing: selectedFiling,
          reader: {
            toc: document.toc,
            keyItems: document.keyItems,
            markdownPreview: document.markdown.slice(0, 12_000),
          },
          reasoningTrace: buildTraceFromToolLog([
            "Loaded latest downloaded filing",
            "Parsed markdown preview and key items",
          ]),
        },
      });

      writeAssistantMessage({
        writer,
        text: formatFullTextPreview({
          filing: selectedFiling,
          markdown: document.markdown,
        }),
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    if (intent === "summary") {
      const summaryResult = await summarizeFilingByStyle({
        companyName: selectedFiling.companyName,
        formType: selectedFiling.formType,
        filingDate: selectedFiling.filingDate,
        sections: document.sections,
        style: "key_info_first",
      });

      writeToolResult({
        writer,
        toolCallId: "local-summary",
        toolName: "summarizeSelectedFiling",
        input: {
          style: "key_info_first",
        },
        output: {
          filing: selectedFiling,
          style: "key_info_first",
          summary: summaryResult.summary,
          reasoningTrace: summaryResult.reasoningTrace,
        },
      });

      writeAssistantMessage({
        writer,
        text: formatSummaryText({
          filing: selectedFiling,
          summary: summaryResult.summary,
        }),
      });
      writer.write({ type: "finish", finishReason: "stop" });
      return true;
    }

    const briefResult = await buildInvestmentDecisionBriefFromFiling({
      companyName: selectedFiling.companyName,
      formType: selectedFiling.formType,
      filingDate: selectedFiling.filingDate,
      sections: document.sections,
    });

    writeToolResult({
      writer,
      toolCallId: "local-brief",
      toolName: "buildInvestmentDecisionBrief",
      input: {
        riskTolerance: null,
        timeHorizon: null,
      },
      output: {
        filing: selectedFiling,
        brief: briefResult.brief,
        reasoningTrace: briefResult.reasoningTrace,
      },
    });

    writeAssistantMessage({
      writer,
      text: formatBriefText({
        filing: selectedFiling,
        brief: briefResult.brief,
      }),
    });
    writer.write({ type: "finish", finishReason: "stop" });
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    writeAssistantMessage({
      writer,
      text: `로컬 SEC fallback 처리 중 오류가 발생했습니다: ${reason}`,
    });
    writer.write({ type: "finish", finishReason: "stop" });
    return true;
  }
}
