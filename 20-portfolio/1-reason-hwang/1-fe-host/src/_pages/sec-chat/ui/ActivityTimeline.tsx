"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, CircleX, LoaderCircle, Workflow, Wrench, Network, Minus } from "lucide-react";
import "@openuidev/react-ui/styles/index.css";

export type Activity = { id: string; label: string; status: "running" | "completed" | "failed" | "cancelled" | "unavailable"; kind: "node" | "request" | "tool"; arguments?: unknown; result?: unknown };
const statuses = { running: "진행 중", completed: "완료", failed: "실패", cancelled: "중단", unavailable: "생성하지 못함" };
const icons = { running: LoaderCircle, completed: Check, failed: CircleX, cancelled: Minus, unavailable: CircleX };

export function ActivityTimeline({ activities, working = false }: { activities: Activity[]; working?: boolean }) {
  const [open, setOpen] = useState(working);
  useEffect(() => { setOpen(working); }, [working]);
  if (!activities.length) return null;
  const failed = activities.some(activity => activity.status === "failed" || activity.status === "unavailable");
  const cancelled = activities.some(activity => activity.status === "cancelled");
  return <details className={`sec-timeline openui-behind-the-scenes openui-behind-the-scenes--${working ? "working" : "settled"}`} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="openui-behind-the-scenes__toggle">
      <span className="openui-behind-the-scenes__glyph"><Workflow size={28} aria-hidden="true" /></span>
      <span className={`openui-behind-the-scenes__toggle-label${working ? " openui-behind-the-scenes__toggle-label--shimmer" : ""}`}>{working ? "Working" : "Behind the scenes"}</span>
      <span className="sec-timeline-count">{working ? "작업 중" : failed ? "일부 작업 실패" : cancelled ? "중단됨" : `${activities.length}개 작업 완료`}</span>
      <ChevronRight size={16} className="openui-behind-the-scenes__toggle-icon" aria-hidden="true" />
    </summary>
    <ol className="openui-behind-the-scenes__items">{activities.map(activity => {
      const Icon = icons[activity.status];
      const KindIcon = activity.kind === "tool" ? Wrench : activity.kind === "request" ? Network : Workflow;
      return <li key={activity.id} data-status={activity.status} className="openui-tool-call sec-activity-row">
        <span className="openui-tool-call__icon-wrapper"><KindIcon size={20} className="openui-tool-call__icon" aria-hidden="true" /></span>
        <div className="sec-activity-label"><span className={`openui-tool-call__name${activity.status === "running" && working ? " openui-tool-call__name--shimmer" : ""}`}>{activity.label}</span><small>{activity.kind === "node" ? "에이전트 단계" : activity.kind === "tool" ? "도구 호출" : "서비스 요청"}</small>{activity.kind === "tool" && <details className="sec-activity-data"><summary><ChevronRight size={14} aria-hidden="true" />도구 인자와 결과</summary><pre className="openui-tool-call__block openui-tool-code-block__code"><code>{`인자\n${JSON.stringify(activity.arguments ?? {}, null, 2)}`}</code>{activity.result !== undefined && <code>{`\n\n결과\n${typeof activity.result === "string" ? activity.result : JSON.stringify(activity.result, null, 2)}`}</code>}</pre></details>}</div>
        <span className="sec-activity-status"><Icon size={14} className={activity.status === "running" && working ? "animate-spin" : undefined} aria-hidden="true" />{statuses[activity.status]}</span>
      </li>;
    })}</ol>
  </details>;
}
