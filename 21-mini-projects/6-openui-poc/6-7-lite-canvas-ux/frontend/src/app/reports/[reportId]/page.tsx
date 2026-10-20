import { notFound } from "next/navigation";
import { backendFetch, validId } from "@/server/backend";
import { ReportView } from "@/canvas/report-view";
import "@/canvas/workspace.css";
export const dynamic = "force-dynamic";
export default async function PublishedReport({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  if (!validId(reportId)) notFound();
  const response = await backendFetch(`/canvas/reports/${reportId}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("리포트 서버에 연결하지 못했습니다.");
  return <main className="published-workspace"><ReportView report={await response.json()} publicView /></main>;
}
