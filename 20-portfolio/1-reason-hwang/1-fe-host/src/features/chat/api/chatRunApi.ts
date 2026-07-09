import type {
  Client,
  MessagesTupleStreamEvent,
  MetadataStreamEvent,
  StreamMode,
  ValuesStreamEvent,
} from "@langchain/langgraph-sdk";

import type { LangGraphChatInputMessage } from "@/features/chat/model/chatTypes";
import type { LangGraphConfig } from "@/shared/config/langgraph";

export type LangGraphStreamEvent =
  | MessagesTupleStreamEvent
  | ValuesStreamEvent<unknown>
  | MetadataStreamEvent
  | {
      event: "error";
      data: {
        error?: string;
        message?: string;
      };
    };

export async function createChatThread(client: Client): Promise<string> {
  const thread = await client.threads.create();

  return thread.thread_id;
}

export function streamChatRun(params: {
  client: Client;
  config: LangGraphConfig;
  threadId: string;
  messages: LangGraphChatInputMessage[];
  signal?: AbortSignal;
}): AsyncIterable<LangGraphStreamEvent> {
  const stream = params.client.runs.stream<StreamMode>(
    params.threadId,
    params.config.assistantId,
    {
      input: {
        messages: params.messages,
      },
      streamMode: params.config.streamMode,
      signal: params.signal,
    },
  );

  return stream as AsyncIterable<LangGraphStreamEvent>;
}

export async function getThreadState(params: {
  client: Client;
  threadId: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  return params.client.threads.getState(params.threadId, undefined, {
    signal: params.signal,
  });
}
