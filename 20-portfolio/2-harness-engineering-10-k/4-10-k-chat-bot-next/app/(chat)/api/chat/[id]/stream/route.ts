import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import {
  pipeParserSseToUiWriter,
  requireParserBackendBaseUrl,
} from "@/lib/parser-chat";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendBaseUrl = requireParserBackendBaseUrl();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const response = await fetch(
        `${backendBaseUrl}/api/langgraph/threads/${id}/stream`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Parser backend resume stream request failed");
      }

      await pipeParserSseToUiWriter({
        stream: response.body,
        writer,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
