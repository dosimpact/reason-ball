import {
  AbstractAgent,
  type BaseEvent,
  EventType,
  type RunAgentInput,
} from "@ag-ui/client";
import { Observable } from "rxjs";
import { buildA2UIActivityContent } from "@/lib/investment-assistant/dashboard";
import { runInvestmentAssistantTurn } from "@/lib/investment-assistant/server";
import { generateUUID } from "@/lib/utils";

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

function chunkText(text: string, maxChunkLength = 180) {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const segments = normalized.split(/\n{2,}/).flatMap((block) => {
    if (block.length <= maxChunkLength) {
      return [block];
    }

    const chunks: string[] = [];
    for (let index = 0; index < block.length; index += maxChunkLength) {
      chunks.push(block.slice(index, index + maxChunkLength));
    }
    return chunks;
  });

  return segments.map((segment) => segment.trim()).filter(Boolean);
}

function emitAssistantText(
  observer: { next: (event: BaseEvent) => void },
  text: string
) {
  const messageId = generateUUID();
  observer.next({
    type: EventType.TEXT_MESSAGE_START,
    messageId,
    role: "assistant",
  } as BaseEvent);

  for (const chunk of chunkText(text)) {
    observer.next({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId,
      delta: `${chunk}\n\n`,
    } as BaseEvent);
  }

  observer.next({
    type: EventType.TEXT_MESSAGE_END,
    messageId,
  } as BaseEvent);
}

export class InvestmentAssistantAgent extends AbstractAgent {
  clone(): AbstractAgent {
    const cloned = new InvestmentAssistantAgent();
    cloned.agentId = this.agentId;
    return cloned;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((observer) => {
      const finish = () => {
        observer.next({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent);
        observer.complete();
      };

      observer.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);

      const runTurn = async () => {
        try {
          const userMessage = getLastUserMessageText(input);

          const { nextState, responseText } = await runInvestmentAssistantTurn({
            userMessage,
            state: input.state as Record<string, unknown> | undefined,
          });

          observer.next({
            type: EventType.STATE_SNAPSHOT,
            snapshot: nextState,
          } as BaseEvent);

          if (nextState.dashboard) {
            observer.next({
              type: EventType.ACTIVITY_SNAPSHOT,
              messageId: generateUUID(),
              activityType: "a2ui-surface",
              content: buildA2UIActivityContent(nextState.dashboard),
            } as BaseEvent);
          }

          emitAssistantText(observer, responseText);
          finish();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Investment assistant run failed";

          emitAssistantText(observer, `Investment assistant error: ${message}`);
          finish();
        }
      };

      runTurn();
    });
  }
}
