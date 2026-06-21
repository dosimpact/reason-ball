"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { FilingMarkdownViewer } from "./filing-markdown-viewer";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { ReasoningTracePanel } from "./reasoning-trace-panel";
import { Weather } from "./weather";

function formatFilingDate(value: string | null | undefined) {
  return value ?? "unknown";
}

function renderListCompanyFilingsOutput(output: any) {
  if (!output || typeof output !== "object") {
    return <div className="p-3 text-sm">No result</div>;
  }

  if ("error" in output) {
    return (
      <div className="p-3 text-red-500 text-sm">
        {String(output.error)}
        {Array.isArray(output.candidates) && output.candidates.length > 0 && (
          <div className="mt-2 text-muted-foreground">
            Candidates:{" "}
            {output.candidates
              .map(
                (candidate: { name?: string; ticker?: string | null }) =>
                  `${candidate.name ?? "unknown"} (${candidate.ticker ?? "N/A"})`
              )
              .join(", ")}
          </div>
        )}
      </div>
    );
  }

  const filings = Array.isArray(output.filings) ? output.filings : [];
  const company = output.company;

  return (
    <div className="space-y-2 p-3 text-sm">
      <div className="font-medium">
        {company?.name ?? "Unknown company"} ({company?.ticker ?? "N/A"})
      </div>
      <div className="max-h-64 overflow-auto rounded border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-1">Form</th>
              <th className="px-2 py-1">Filing Date</th>
              <th className="px-2 py-1">Accession</th>
            </tr>
          </thead>
          <tbody>
            {filings.map((filing: any) => (
              <tr
                className="border-t"
                key={`${filing.cik}-${filing.accessionNo}`}
              >
                <td className="px-2 py-1">{filing.formType}</td>
                <td className="px-2 py-1">
                  {formatFilingDate(filing.filingDate)}
                </td>
                <td className="px-2 py-1">{filing.accessionNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {"reasoningTrace" in output && (
        <ReasoningTracePanel trace={output.reasoningTrace} />
      )}
    </div>
  );
}

function renderSummaryOutput(summary: any) {
  const bullets = Array.isArray(summary?.keyBullets) ? summary.keyBullets : [];
  const risks = Array.isArray(summary?.keyRisks) ? summary.keyRisks : [];
  const evidence = Array.isArray(summary?.evidence) ? summary.evidence : [];

  const markdown = [
    summary?.executiveSummary
      ? `### Executive Summary\n${summary.executiveSummary}`
      : null,
    bullets.length > 0
      ? `### Key Points\n${bullets.map((item: string) => `- ${item}`).join("\n")}`
      : null,
    risks.length > 0
      ? `### Key Risks\n${risks.map((item: string) => `- ${item}`).join("\n")}`
      : null,
    evidence.length > 0
      ? `### Evidence Items\n${evidence
          .map(
            (item: { itemCode?: string; rationale?: string }) =>
              `- Item ${item.itemCode ?? "?"}: ${item.rationale ?? ""}`
          )
          .join("\n")}`
      : null,
    summary?.oneLiner ? `### One-liner\n${summary.oneLiner}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-2 p-3">
      <Response className="text-sm">
        {markdown || "No summary available"}
      </Response>
    </div>
  );
}

function renderInvestmentBriefOutput(brief: any) {
  const markdown = [
    brief?.stance ? `### Stance\n- ${brief.stance}` : null,
    brief?.conclusion ? `### Conclusion\n${brief.conclusion}` : null,
    Array.isArray(brief?.bull) && brief.bull.length > 0
      ? `### Bull\n${brief.bull.map((item: string) => `- ${item}`).join("\n")}`
      : null,
    Array.isArray(brief?.bear) && brief.bear.length > 0
      ? `### Bear\n${brief.bear.map((item: string) => `- ${item}`).join("\n")}`
      : null,
    Array.isArray(brief?.unknowns) && brief.unknowns.length > 0
      ? `### Unknowns\n${brief.unknowns.map((item: string) => `- ${item}`).join("\n")}`
      : null,
    Array.isArray(brief?.nextChecks) && brief.nextChecks.length > 0
      ? `### Next Checks\n${brief.nextChecks
          .map((item: string) => `- ${item}`)
          .join("\n")}`
      : null,
    Array.isArray(brief?.evidence) && brief.evidence.length > 0
      ? `### Evidence\n${brief.evidence
          .map(
            (item: { itemCode?: string; rationale?: string }) =>
              `- Item ${item.itemCode ?? "?"}: ${item.rationale ?? ""}`
          )
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-2 p-3">
      <Response className="text-sm">
        {markdown || "No investment brief available"}
      </Response>
    </div>
  );
}

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "w-full":
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                ) ||
                  message.parts?.some((p) => p.type.startsWith("tool-")))) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning") {
              const hasContent = part.text?.trim().length > 0;
              const isStreaming = "state" in part && part.state === "streaming";
              if (hasContent || isStreaming) {
                return (
                  <MessageReasoning
                    isLoading={isLoading || isStreaming}
                    key={key}
                    reasoning={part.text || ""}
                  />
                );
              }
            }

            if (type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "wrap-break-word w-fit rounded-2xl px-3 py-2 text-right text-white":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#006cff" }
                          : undefined
                      }
                    >
                      <Response>{sanitizeText(part.text)}</Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;
              const approvalId = (part as { approval?: { id: string } })
                .approval?.id;
              const isDenied =
                state === "output-denied" ||
                (state === "approval-responded" &&
                  (part as { approval?: { approved?: boolean } }).approval
                    ?.approved === false);
              const widthClass = "w-[min(100%,450px)]";

              if (state === "output-available") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Weather weatherAtLocation={part.output} />
                  </div>
                );
              }

              if (isDenied) {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader
                        state="output-denied"
                        type="tool-getWeather"
                      />
                      <ToolContent>
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          Weather lookup was denied.
                        </div>
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              if (state === "approval-responded") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader state={state} type="tool-getWeather" />
                      <ToolContent>
                        <ToolInput input={part.input} />
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool className="w-full" defaultOpen={true}>
                    <ToolHeader state={state} type="tool-getWeather" />
                    <ToolContent>
                      {(state === "input-available" ||
                        state === "approval-requested") && (
                        <ToolInput input={part.input} />
                      )}
                      {state === "approval-requested" && approvalId && (
                        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                          <button
                            className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              addToolApprovalResponse({
                                id: approvalId,
                                approved: false,
                                reason: "User denied weather lookup",
                              });
                            }}
                            type="button"
                          >
                            Deny
                          </button>
                          <button
                            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                            onClick={() => {
                              addToolApprovalResponse({
                                id: approvalId,
                                approved: true,
                              });
                            }}
                            type="button"
                          >
                            Allow
                          </button>
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={part.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...part.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={part.output}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={part.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-listCompanyFilings") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-listCompanyFilings" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={renderListCompanyFilingsOutput(part.output)}
                      />
                    )}
                    {state === "output-error" && (
                      <ToolOutput errorText={part.errorText} output={null} />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-openLatestFilingFullText") {
              const { toolCallId, state } = part;
              const output = part.output as any;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader
                    state={state}
                    type="tool-openLatestFilingFullText"
                  />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <div className="space-y-3 p-3">
                        {output &&
                        typeof output === "object" &&
                        "error" in output ? (
                          <div className="text-red-500 text-sm">
                            {String(output.error)}
                          </div>
                        ) : (
                          <>
                            <div className="rounded border bg-muted/20 p-2 text-xs">
                              <div>
                                <span className="font-medium">Form:</span>{" "}
                                {output?.filing?.formType}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Filing Date:
                                </span>{" "}
                                {formatFilingDate(output?.filing?.filingDate)}
                              </div>
                              <div>
                                <span className="font-medium">Accession:</span>{" "}
                                {output?.filing?.accessionNo}
                              </div>
                            </div>
                            {output?.document?.id && (
                              <DocumentToolResult
                                isReadonly={isReadonly}
                                result={output.document}
                                type="create"
                              />
                            )}
                            {output?.document?.id && (
                              <FilingMarkdownViewer
                                documentId={output.document.id}
                                toc={output?.reader?.toc ?? []}
                              />
                            )}
                            {output?.reasoningTrace && (
                              <ReasoningTracePanel
                                trace={output.reasoningTrace}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {state === "output-error" && (
                      <ToolOutput errorText={part.errorText} output={null} />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-summarizeSelectedFiling") {
              const { toolCallId, state } = part;
              const output = part.output as any;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader
                    state={state}
                    type="tool-summarizeSelectedFiling"
                  />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <div className="space-y-2 p-2">
                        {output &&
                        typeof output === "object" &&
                        "error" in output ? (
                          <div className="p-2 text-red-500 text-sm">
                            {String(output.error)}
                          </div>
                        ) : (
                          <>
                            {renderSummaryOutput(output.summary)}
                            {output?.reasoningTrace && (
                              <ReasoningTracePanel
                                trace={output.reasoningTrace}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {state === "output-error" && (
                      <ToolOutput errorText={part.errorText} output={null} />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-buildInvestmentDecisionBrief") {
              const { toolCallId, state } = part;
              const output = part.output as any;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader
                    state={state}
                    type="tool-buildInvestmentDecisionBrief"
                  />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <div className="space-y-2 p-2">
                        {output &&
                        typeof output === "object" &&
                        "error" in output ? (
                          <div className="p-2 text-red-500 text-sm">
                            {String(output.error)}
                          </div>
                        ) : (
                          <>
                            {renderInvestmentBriefOutput(output.brief)}
                            {output?.reasoningTrace && (
                              <ReasoningTracePanel
                                trace={output.reasoningTrace}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {state === "output-error" && (
                      <ToolOutput errorText={part.errorText} output={null} />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
            <span className="animate-pulse">Thinking</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
