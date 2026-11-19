"use client";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { useRequestLock } from "@/shared/lib/hooks";
import { ModelingView } from "./ModelingView";
import { ModelingApiTesting } from "./ModelingApiTesting";
import { useModeling } from "./useModeling";
export function SecModelingPage() {
  const execution = useRequestLock<"modeling" | "api-testing">();
  const controller = useModeling(execution);
  const [tab, setTab] = useState("operations");
  return <div className="min-w-0">
    <div role="tablist" aria-label="SEC 모델링 화면" className="mx-auto flex max-w-[1600px] flex-wrap gap-2 border-b px-4 pb-3 pt-4 md:px-6">{[{ id: "operations", label: "모델링 관리" }, { id: "api", label: "API Testing" }].map(item => <Button key={item.id} role="tab" id={`modeling-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`modeling-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault();
      const next = event.key === "Home" ? "operations" : event.key === "End" ? "api" : item.id === "operations" ? "api" : "operations";
      setTab(next); document.getElementById(`modeling-tab-${next}`)?.focus();
    }}>{item.label}</Button>)}{execution.owner && <span role="status" className="self-center text-xs text-muted-foreground">{execution.owner === "modeling" ? "운영 API 요청 중" : "Testing API 요청 중"}</span>}</div>
    <div role="tabpanel" id="modeling-panel-operations" aria-labelledby="modeling-tab-operations" hidden={tab !== "operations"}><ModelingView {...controller} /></div>
    <div role="tabpanel" id="modeling-panel-api" aria-labelledby="modeling-tab-api" hidden={tab !== "api"} className="mx-auto max-w-[1600px] p-4 pb-20 md:p-6"><ModelingApiTesting execution={execution} onMutation={controller.refresh} selected={controller.selected} run={controller.run} /></div>
  </div>;
}
