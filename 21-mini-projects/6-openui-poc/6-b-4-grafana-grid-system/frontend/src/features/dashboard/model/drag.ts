import { z } from "zod";
const dragSchema = z.discriminatedUnion("type", [
  z.object({
    version: z.literal(1),
    threadId: z.string(),
    type: z.literal("artifact"),
    artifactId: z.string(),
    uiState: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    version: z.literal(1),
    threadId: z.string(),
    type: z.literal("panel"),
    panelId: z.string(),
  }),
]);
export function parseCanvasDrag(raw: string, threadId: string) {
  if (!raw || raw.length > 65536)
    throw new Error("Invalid Canvas payload size");
  const payload = dragSchema.parse(JSON.parse(raw));
  if (payload.threadId !== threadId)
    throw new Error("Cross-thread drop rejected");
  return payload;
}
