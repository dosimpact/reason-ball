"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, CircleX, LoaderCircle, Workflow, Wrench, Network, Minus } from "lucide-react";
import "./activity-timeline.css";

export type Activity = { id: string; label: string; status: "running" | "completed" | "failed" | "cancelled" | "unavailable"; kind: "node" | "request" | "tool"; arguments?: unknown; result?: unknown };
const statuses = { running: "진행 중", completed: "완료", failed: "실패", cancelled: "중단", unavailable: "생성하지 못함" };
const icons = { running: LoaderCircle, completed: Check, failed: CircleX, cancelled: Minus, unavailable: CircleX };
const kinds = { node: "에이전트 단계", tool: "도구 호출", request: "서비스 요청" };

function ActivityRow({ activity, working }: { activity: Activity; working: boolean }) {
  const StatusIcon = icons[activity.status];
  const KindIcon = activity.kind === "tool" ? Wrench : activity.kind === "request" ? Network : Workflow;
  return <li className="sec-trace__item" data-status={activity.status}>
    <div className="sec-trace__step-icon"><KindIcon size={16} aria-hidden="true" /></div>
    <div className="sec-trace__step">
      <p className="sec-trace__name">{activity.label}</p>
      <div className="sec-trace__meta">
        <span>{kinds[activity.kind]}</span>
        <span className="sec-trace__status"><StatusIcon size={12} className={activity.status === "running" && working ? "sec-trace__spinner" : undefined} aria-hidden="true" />{statuses[activity.status]}</span>
      </div>
      {activity.kind === "tool" && <details className="sec-trace__payload">
        <summary><ChevronRight size={14} aria-hidden="true" />도구 인자와 결과</summary>
        <div className="sec-trace__payload-body">
          <p>인자</p><pre><code>{JSON.stringify(activity.arguments ?? {}, null, 2)}</code></pre>
          {activity.result !== undefined && <><p>결과</p><pre><code>{typeof activity.result === "string" ? activity.result : JSON.stringify(activity.result, null, 2)}</code></pre></>}
        </div>
      </details>}
    </div>
  </li>;
}

export function ActivityTimeline({ activities, working = false }: { activities: Activity[]; working?: boolean }) {
  const [open, setOpen] = useState(working);
  useEffect(() => { setOpen(working); }, [working]);
  if (!activities.length) return null;
  const failed = activities.some(activity => activity.status === "failed" || activity.status === "unavailable");
  const cancelled = activities.some(activity => activity.status === "cancelled");
  const description = working ? "작업 중" : failed ? "일부 작업 실패" : cancelled ? "중단됨" : `${activities.length}개 작업 완료`;
  return <details className="sec-trace" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="sec-trace__toggle">
      <Workflow size={18} className="sec-trace__icon" aria-hidden="true" />
      <span className="sec-trace__heading"><span className="sec-trace__title">{working ? "Working" : "Behind the scenes"}</span><span className="sec-trace__description">{description}</span></span>
      <ChevronRight size={16} className="sec-trace__chevron" aria-hidden="true" />
    </summary>
    <ol className="sec-trace__list">{activities.map(activity => <ActivityRow key={activity.id} activity={activity} working={working} />)}</ol>
  </details>;
}
