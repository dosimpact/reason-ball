import { proxyJson, validId } from "@/server/backend";
export async function GET(_: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return validId(reportId) ? proxyJson(`/canvas/reports/${reportId}`) : Response.json({ error: "Invalid ID" }, { status: 400 });
}
