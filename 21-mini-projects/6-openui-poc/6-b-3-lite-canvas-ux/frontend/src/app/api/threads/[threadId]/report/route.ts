import { proxyJson, validId } from "@/server/backend";
export async function GET(_: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return validId(threadId) ? proxyJson(`/canvas/threads/${threadId}/report`) : Response.json({ error: "Invalid ID" }, { status: 400 });
}
