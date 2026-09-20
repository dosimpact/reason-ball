"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { Button } from "@/components/ui/button";
import { createHostCatalog } from "@/lib/a2ui/catalog";
import manifest from "@/lib/a2ui/generated/manifest.json";
import { RunProgress } from "./progress";
import { createDemoActivityRenderer } from "./activity-renderer";
import "@copilotkit/react-core/v2/styles.css";

export function A2UIDemo({ mode }: { mode: "dynamic" | "fixed" | "sec" }) {
  const [session, setSession] = useState(0);
  return <main className="mx-auto max-w-5xl p-6"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><Link href="/a2ui" className="text-sm underline">A2UI 데모</Link><h1 className="mt-2 text-2xl font-semibold">{mode === "sec" ? "SEC 회사 조회 · 공시 분석" : mode === "dynamic" ? "매출 분석 · Dynamic" : "항공편 선택 · Fixed"}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "sec" ? "저장된 회사를 검색하고 공시를 선택해 근거 기반 보고서를 만드세요." : mode === "dynamic" ? "가상 매출 데이터를 질문에 맞는 화면으로 확인하세요." : "가상 항공편 카드를 조회하고 선택하세요. 실제 예약은 진행되지 않습니다."}</p></div><Button variant="outline" onClick={() => setSession(value => value + 1)}>새 대화</Button></header><DemoSession key={`${mode}-${session}`} mode={mode} /></main>;
}

function DemoSession({ mode }: { mode: "dynamic" | "fixed" | "sec" }) {
  const catalog = useMemo(() => createHostCatalog(mode), [mode]);
  const renderers = useMemo(() => [createDemoActivityRenderer(catalog)], [catalog]);
  const [error, setError] = useState<string | null>(null);
  const properties = useMemo(() => ({ a2uiContract: { protocolVersion: manifest.protocolVersion, ...manifest.catalogs[mode] } }), [mode]);
  return <CopilotKitProvider runtimeUrl={`/api/copilotkit/a2ui/${mode}`} agentId={`a2ui-${mode}`} useSingleEndpoint properties={properties} a2ui={{ catalog, includeSchema: false }} renderActivityMessages={renderers} enableInspector={false} onError={({ error }) => setError(error.message)}>
    {error && <div role="alert" className="mb-4 rounded-lg border border-destructive p-4"><p>{error}</p><Button variant="ghost" onClick={() => setError(null)}>알림 닫기</Button></div>}
    <div className="mb-4 rounded-lg bg-muted p-4 text-sm">{mode === "sec" ? "회사명 또는 티커를 입력하세요. 예시: AAPL · Apple · Microsoft. 공시를 선택한 뒤 보고서 생성을 누르세요." : mode === "dynamic" ? "예시: 전체 매출 현황을 보여줘 · 담당자별 실적을 비교해줘 · 지역별 매출 비중을 보여줘" : "예시: 인천에서 도쿄로 가는 항공편을 보여줘 · 부산에서 오사카로 가는 항공편"}</div>
    <RunProgress agentId={`a2ui-${mode}`} />
    <div className="min-h-[60vh] rounded-xl border"><CopilotChat agentId={`a2ui-${mode}`} labels={{ welcomeMessageText: mode === "sec" ? "어떤 회사를 조회할까요? 회사명 또는 티커를 입력하세요." : mode === "dynamic" ? "어떤 매출 정보를 살펴볼까요?" : "어떤 항공편을 살펴볼까요?", chatInputPlaceholder: mode === "sec" ? "회사명 또는 티커" : "질문을 입력하세요" }} /></div>
  </CopilotKitProvider>;
}
