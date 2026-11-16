"use client";

import { useEffect, useState } from "react";

export type Activity = { id: string; label: string; status: "running" | "completed" | "failed" | "cancelled" | "unavailable"; kind: "node" | "request" | "tool"; arguments?: unknown; result?: unknown };
const statuses = { running: "진행 중", completed: "완료", failed: "실패", cancelled: "중단", unavailable: "생성하지 못함" };
const icons = { running: "◌", completed: "✓", failed: "!", cancelled: "−", unavailable: "!" };

export function ActivityTimeline({ activities, working = false }: { activities: Activity[]; working?: boolean }) {
  const [open, setOpen] = useState(working);
  useEffect(() => { setOpen(working); }, [working]);
  if (!activities.length) return null;
  const failed = activities.some(activity => activity.status === "failed" || activity.status === "unavailable");
  const cancelled = activities.some(activity => activity.status === "cancelled");
  return <details className="sec-timeline" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{working ? "Working" : "Behind the scenes"}<span>{working ? "작업 중" : failed ? "일부 작업 실패" : cancelled ? "중단됨" : `${activities.length}개 작업 완료`}</span></summary>
    <ol>{activities.map(activity => <li key={activity.id} data-status={activity.status}><span aria-hidden="true" className="sec-activity-icon">{icons[activity.status]}</span><div className="sec-activity-label">{activity.label}<small>{activity.kind === "node" ? "에이전트 단계" : activity.kind === "tool" ? "도구 호출" : "서비스 요청"}</small>{activity.kind === "tool" && <details className="mt-2"><summary>도구 인자와 결과</summary><p className="mt-2 font-medium">인자</p><pre className="overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(activity.arguments ?? {}, null, 2)}</pre>{activity.result !== undefined && <><p className="mt-2 font-medium">결과</p><pre className="overflow-auto whitespace-pre-wrap break-all">{typeof activity.result === "string" ? activity.result : JSON.stringify(activity.result, null, 2)}</pre></>}</details>}</div><span className="sec-activity-status">{statuses[activity.status]}</span></li>)}</ol>
  </details>;
}
