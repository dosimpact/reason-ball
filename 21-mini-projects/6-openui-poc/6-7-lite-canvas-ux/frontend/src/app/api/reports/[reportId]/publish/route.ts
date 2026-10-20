import { proxyJson, validId } from "@/server/backend";
export async function POST(_: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return validId(reportId) ? proxyJson(`/canvas/reports/${reportId}/publish`, "POST") : Response.json({ error: "Invalid ID" }, { status: 400 });
}
