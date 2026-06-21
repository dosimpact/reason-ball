import { type BaseEvent, EventType, type RunAgentInput } from "@ag-ui/client";
import {
  buildA2UIActivityContent,
  buildInvestmentDashboard,
} from "@/lib/investment-assistant/dashboard";
import {
  appendRuntimeIssue,
  createRuntimeIssue,
} from "@/lib/investment-assistant/runtime";
import { runInvestmentAssistantTurn } from "@/lib/investment-assistant/server";
import type {
  GraphEvidence,
  InvestmentAssistantState,
} from "@/lib/investment-assistant/types";
import {
  ensureParserThread,
  PARSER_ASSISTANT_ID,
  requireParserBackendBaseUrl,
} from "@/lib/parser-chat";
import { generateUUID } from "@/lib/utils";

type ParserEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "finish"; finishReason?: unknown; usage?: unknown }
  | { type: "data-retrieval-debug"; data?: unknown }
  | { type: "data-selected-filing"; data?: unknown };

type ParserRunSummary = {
  responseText: string;
  retrievalDebug: Record<string, unknown> | null;
  selectedFiling: Record<string, unknown> | null;
};

const HTML_TAG_REGEX = /<[^>]+>/g;
const NUMERIC_ENTITY_REGEX = /&#(\d+);/g;

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(NUMERIC_ENTITY_REGEX, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
}

function sanitizeGraphText(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  return decodeHtmlEntities(input)
    .replace(HTML_TAG_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractTextFromMessageContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      const candidate = part as { type?: string; text?: string };

      if (candidate.type === "text" && typeof candidate.text === "string") {
        return candidate.text;
      }

      return "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getLastUserMessageText(input: RunAgentInput) {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index] as {
      role?: string;
      content?: unknown;
    };

    if (message.role !== "user") {
      continue;
    }

    const text = extractTextFromMessageContent(message.content);
    if (text) {
      return text;
    }
  }

  return "";
}

function isTruthyEnv(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

function shouldSimulateParserRuntimeFailure(userMessage: string) {
  const failureHooksEnabled =
    isTruthyEnv(process.env.INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS) ||
    isTruthyEnv(process.env.PLAYWRIGHT);

  return (
    failureHooksEnabled &&
    userMessage.includes("__simulate_parser_runtime_unavailable__")
  );
}

function toGraphEvidence(evidence: Record<string, unknown>): GraphEvidence {
  return {
    citationLabel:
      typeof evidence.citationLabel === "string"
        ? evidence.citationLabel
        : typeof evidence.citation_label === "string"
          ? evidence.citation_label
          : "Item ?",
    nodeType:
      typeof evidence.nodeType === "string"
        ? evidence.nodeType
        : typeof evidence.node_type === "string"
          ? evidence.node_type
          : "SectionText",
    text: sanitizeGraphText(
      typeof evidence.text === "string" ? evidence.text : null
    ),
    itemCode:
      typeof evidence.itemCode === "string"
        ? evidence.itemCode
        : typeof evidence.item_code === "string"
          ? evidence.item_code
          : null,
    filingId:
      typeof evidence.filingId === "string"
        ? evidence.filingId
        : typeof evidence.filing_id === "string"
          ? evidence.filing_id
          : null,
    companyName:
      typeof evidence.companyName === "string"
        ? evidence.companyName
        : typeof evidence.company_name === "string"
          ? evidence.company_name
          : null,
    score:
      typeof evidence.score === "number"
        ? evidence.score
        : Number.isFinite(Number(evidence.score))
          ? Number(evidence.score)
          : 0,
    reason: typeof evidence.reason === "string" ? evidence.reason : "",
  };
}

function mergeParserSummaryIntoState(
  nextState: InvestmentAssistantState,
  parserRun: ParserRunSummary
) {
  if (!nextState.companyQuery && parserRun.selectedFiling) {
    const companyName =
      typeof parserRun.selectedFiling.company_name === "string"
        ? parserRun.selectedFiling.company_name
        : typeof parserRun.selectedFiling.companyName === "string"
          ? parserRun.selectedFiling.companyName
          : null;
    const ticker =
      typeof parserRun.selectedFiling.ticker === "string"
        ? parserRun.selectedFiling.ticker
        : null;

    nextState.companyQuery = ticker ?? companyName ?? nextState.companyQuery;
  }

  if (!nextState.selectedFiling && parserRun.selectedFiling) {
    const filingUrl =
      typeof parserRun.selectedFiling.filing_url === "string"
        ? parserRun.selectedFiling.filing_url
        : typeof parserRun.selectedFiling.filingUrl === "string"
          ? parserRun.selectedFiling.filingUrl
          : "";

    nextState.selectedFiling = {
      accessionNo:
        typeof parserRun.selectedFiling.accession_no === "string"
          ? parserRun.selectedFiling.accession_no
          : typeof parserRun.selectedFiling.accessionNo === "string"
            ? parserRun.selectedFiling.accessionNo
            : "",
      companyName:
        typeof parserRun.selectedFiling.company_name === "string"
          ? parserRun.selectedFiling.company_name
          : typeof parserRun.selectedFiling.companyName === "string"
            ? parserRun.selectedFiling.companyName
            : "Unknown company",
      ticker:
        typeof parserRun.selectedFiling.ticker === "string"
          ? parserRun.selectedFiling.ticker
          : null,
      cik:
        typeof parserRun.selectedFiling.cik === "string"
          ? parserRun.selectedFiling.cik
          : "",
      formType:
        typeof parserRun.selectedFiling.form_type === "string"
          ? parserRun.selectedFiling.form_type
          : typeof parserRun.selectedFiling.formType === "string"
            ? parserRun.selectedFiling.formType
            : "10-K",
      filingDate:
        typeof parserRun.selectedFiling.filing_date === "string"
          ? parserRun.selectedFiling.filing_date
          : typeof parserRun.selectedFiling.filingDate === "string"
            ? parserRun.selectedFiling.filingDate
            : null,
      reportDate: null,
      filingUrl,
      provenance: {
        dataSource: "collector-database",
        documentSource: filingUrl ? "sec-archive-url" : "metadata-only",
        collectorUpdatedAt: null,
        parserStatus: null,
        isDownloaded: false,
        hasLocalFile: false,
        freshnessStatus: "unknown",
        freshnessDetail: "Collector update timestamp is unavailable.",
        refreshHint:
          "Run the collector metadata and download jobs before relying on this filing as the latest available data.",
      },
    };
  }

  const citations = Array.isArray(parserRun.retrievalDebug?.citations)
    ? parserRun.retrievalDebug.citations
        .filter(
          (citation): citation is Record<string, unknown> =>
            Boolean(citation) && typeof citation === "object"
        )
        .map(toGraphEvidence)
    : [];
  const selectedAccession =
    nextState.selectedFiling?.accessionNo ||
    (typeof parserRun.selectedFiling?.accession_no === "string"
      ? parserRun.selectedFiling.accession_no
      : typeof parserRun.selectedFiling?.accessionNo === "string"
        ? parserRun.selectedFiling.accessionNo
        : null);
  const selectedCompany =
    nextState.selectedFiling?.companyName ||
    (typeof parserRun.selectedFiling?.company_name === "string"
      ? parserRun.selectedFiling.company_name
      : typeof parserRun.selectedFiling?.companyName === "string"
        ? parserRun.selectedFiling.companyName
        : null);
  const scopedCitations = citations.filter((citation) => {
    const matchesAccession =
      typeof selectedAccession === "string" &&
      selectedAccession.length > 0 &&
      Boolean(citation.filingId?.includes(selectedAccession));
    const matchesCompany =
      typeof selectedCompany === "string" &&
      selectedCompany.length > 0 &&
      citation.companyName?.toUpperCase() === selectedCompany.toUpperCase();

    return matchesAccession || matchesCompany;
  });
  const evidenceBundle =
    scopedCitations.length > 0 ? scopedCitations : citations;

  if (citations.length > 0 || parserRun.responseText.trim()) {
    nextState.graph = {
      intent:
        typeof parserRun.retrievalDebug?.intent === "string"
          ? parserRun.retrievalDebug.intent
          : (nextState.graph?.intent ?? null),
      answer:
        sanitizeGraphText(parserRun.responseText) ||
        (nextState.graph?.answer ?? null),
      evidenceBundle:
        evidenceBundle.length > 0
          ? evidenceBundle
          : (nextState.graph?.evidenceBundle ?? []),
    };
  }

  nextState.dashboard = buildInvestmentDashboard(nextState);
  nextState.lastUpdatedAt = new Date().toISOString();
}

async function streamParserRunToAgUi({
  threadId,
  parserScope,
  userMessage,
  emit,
}: {
  threadId: string;
  parserScope: Partial<InvestmentAssistantState>;
  userMessage: string;
  emit: (event: BaseEvent) => void;
}): Promise<ParserRunSummary> {
  const backendBaseUrl = requireParserBackendBaseUrl();

  await ensureParserThread({ chatId: threadId });

  const response = await fetch(
    `${backendBaseUrl}/api/langgraph/threads/${threadId}/runs/stream`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        assistantId: PARSER_ASSISTANT_ID,
        chatId: threadId,
        message: userMessage,
        companyQuery: parserScope.companyQuery ?? undefined,
        ticker: parserScope.selectedFiling?.ticker ?? undefined,
        cik: parserScope.selectedFiling?.cik ?? undefined,
        accessionNo: parserScope.selectedFiling?.accessionNo ?? undefined,
        selectedFiling: parserScope.selectedFiling
          ? {
              accessionNo: parserScope.selectedFiling.accessionNo,
              companyName: parserScope.selectedFiling.companyName,
              ticker: parserScope.selectedFiling.ticker,
              cik: parserScope.selectedFiling.cik,
              formType: parserScope.selectedFiling.formType,
              filingDate: parserScope.selectedFiling.filingDate,
            }
          : undefined,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `LangGraph bridge request failed (${response.status}): ${body || "unknown error"}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let responseText = "";
  let retrievalDebug: Record<string, unknown> | null = null;
  let selectedFiling: Record<string, unknown> | null = null;
  let activeMessageId: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const line = rawEvent
        .split("\n")
        .find((candidate) => candidate.startsWith("data: "));
      if (!line) {
        continue;
      }

      let payload: ParserEvent;
      try {
        payload = JSON.parse(line.slice(6)) as ParserEvent;
      } catch {
        continue;
      }

      switch (payload.type) {
        case "text-start":
          activeMessageId = payload.id || generateUUID();
          emit({
            type: EventType.TEXT_MESSAGE_START,
            messageId: activeMessageId,
            role: "assistant",
          } as BaseEvent);
          break;
        case "text-delta":
          if (!activeMessageId) {
            activeMessageId = payload.id || generateUUID();
            emit({
              type: EventType.TEXT_MESSAGE_START,
              messageId: activeMessageId,
              role: "assistant",
            } as BaseEvent);
          }

          responseText += payload.delta;
          emit({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: activeMessageId,
            delta: payload.delta,
          } as BaseEvent);
          break;
        case "text-end":
          if (activeMessageId) {
            emit({
              type: EventType.TEXT_MESSAGE_END,
              messageId: activeMessageId,
            } as BaseEvent);
            activeMessageId = null;
          }
          break;
        case "data-retrieval-debug": {
          const parsed = safeJsonParse(payload.data);
          retrievalDebug =
            parsed && typeof parsed === "object"
              ? (parsed as Record<string, unknown>)
              : null;
          break;
        }
        case "data-selected-filing": {
          const parsed = safeJsonParse(payload.data);
          selectedFiling =
            parsed && typeof parsed === "object"
              ? (parsed as Record<string, unknown>)
              : null;
          break;
        }
        case "finish":
          break;
        default:
          break;
      }
    }
  }

  if (activeMessageId) {
    emit({
      type: EventType.TEXT_MESSAGE_END,
      messageId: activeMessageId,
    } as BaseEvent);
  }

  return {
    responseText,
    retrievalDebug,
    selectedFiling,
  };
}

function emitAssistantError(emit: (event: BaseEvent) => void, message: string) {
  const messageId = generateUUID();

  emit({
    type: EventType.TEXT_MESSAGE_START,
    messageId,
    role: "assistant",
  } as BaseEvent);
  emit({
    type: EventType.TEXT_MESSAGE_CONTENT,
    messageId,
    delta: message,
  } as BaseEvent);
  emit({
    type: EventType.TEXT_MESSAGE_END,
    messageId,
  } as BaseEvent);
}

export async function POST(request: Request) {
  const input = (await request.json()) as RunAgentInput;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: BaseEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      emit({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);

      try {
        const userMessage = getLastUserMessageText(input);
        if (!userMessage) {
          throw new Error("No user message found");
        }

        const preflight = await runInvestmentAssistantTurn({
          userMessage,
          state: input.state as Partial<InvestmentAssistantState> | undefined,
        });

        const nextState = preflight.nextState;

        emit({
          type: EventType.STATE_SNAPSHOT,
          snapshot: nextState,
        } as BaseEvent);

        try {
          if (shouldSimulateParserRuntimeFailure(userMessage)) {
            throw new Error(
              "Simulated parser runtime failure for e2e coverage"
            );
          }

          const parserRun = await streamParserRunToAgUi({
            threadId: input.threadId,
            parserScope: {
              ...nextState,
            },
            userMessage,
            emit,
          });

          mergeParserSummaryIntoState(nextState, parserRun);
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "parser runtime stream failed";
          appendRuntimeIssue(
            nextState,
            createRuntimeIssue({
              source: "parser-runtime",
              title: "Parser runtime unavailable",
              detail,
              recovery:
                "Check the parser service on port 3406, then retry the same prompt.",
            })
          );
          nextState.dashboard = buildInvestmentDashboard(nextState);
          emitAssistantError(
            emit,
            [
              "Parser runtime is unavailable, so live LangGraph narration could not complete.",
              "I preserved the current filing workspace state and marked the runtime status as degraded.",
              "Recovery: check the parser service on port 3406, then retry the same prompt.",
            ].join("\n")
          );
        }

        emit({
          type: EventType.STATE_SNAPSHOT,
          snapshot: nextState,
        } as BaseEvent);

        if (nextState.dashboard) {
          emit({
            type: EventType.ACTIVITY_SNAPSHOT,
            messageId: generateUUID(),
            activityType: "a2ui-surface",
            content: buildA2UIActivityContent(nextState.dashboard),
          } as BaseEvent);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Investment assistant LangGraph bridge failed";
        emitAssistantError(emit, `Investment assistant error: ${message}`);
      } finally {
        emit({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
