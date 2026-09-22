"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { Button } from "@/components/ui/button";
import { createHostCatalog } from "@/lib/a2ui/catalog";
import manifest from "@/lib/a2ui/generated/manifest.json";
import { ChatViewport } from "./chat-viewport";
import { SecWelcome, SecPromptGuide, SecFinancialShortcut } from "./sec-welcome";
import { fixedDemoCopy } from "./fixed-copy";
import { OutputWorkspace, OutputTargetSelect, type OutputTarget } from "./output-workspace";
import { RunProgress } from "./progress";
import { createDemoActivityRenderer } from "./activity-renderer";
import { ProgressivePreview, RenderModeSelect, type RenderMode } from "./progressive-preview";
import "@copilotkit/react-core/v2/styles.css";

export function A2UIDemo({ mode }: { mode: "dynamic" | "fixed" | "sec" }) {
  const [session, setSession] = useState(0);
  return <main className="mx-auto max-w-7xl p-6"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><Link href="/a2ui" className="text-sm underline">A2UI 데모</Link><h1 className="mt-2 text-2xl font-semibold">{mode === "sec" ? "SEC 회사 조회 · 공시 분석" : mode === "dynamic" ? "매출 분석 · Dynamic" : fixedDemoCopy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "sec" ? "회사를 검색하고 공시를 선택한 뒤, 필요한 분석만 요청하세요." : mode === "dynamic" ? "가상 매출 데이터를 질문에 맞는 화면으로 확인하세요." : fixedDemoCopy.description}</p></div><Button variant="outline" onClick={() => setSession(value => value + 1)}>새 대화</Button></header><DemoSession key={`${mode}-${session}`} mode={mode} /></main>;
}

function DemoSession({ mode }: { mode: "dynamic" | "fixed" | "sec" }) {
  const catalog = useMemo(() => createHostCatalog(mode), [mode]);
  const renderers = useMemo(() => [createDemoActivityRenderer(catalog)], [catalog]);
  const [error, setError] = useState<string | null>(null);
  const [outputTarget, setOutputTarget] = useState<OutputTarget>("inline");
  const [renderMode, setRenderMode] = useState<RenderMode>("progressive");
  const properties = useMemo(() => ({ a2uiContract: { protocolVersion: manifest.protocolVersion, ...manifest.catalogs[mode] }, a2uiOutputTarget: outputTarget, a2uiRenderMode: mode === "dynamic" ? renderMode : "batch" }), [mode, renderMode, outputTarget]);
  return <CopilotKitProvider runtimeUrl={`/api/copilotkit/a2ui/${mode}`} agentId={`a2ui-${mode}`} useSingleEndpoint properties={properties} a2ui={{ catalog, includeSchema: false }} renderActivityMessages={renderers} enableInspector={false} onError={({ error }) => setError(error.message)}>
    {error && <div role="alert" className="mb-4 rounded-lg border border-destructive p-4"><p>{error}</p><Button variant="ghost" onClick={() => setError(null)}>알림 닫기</Button></div>}
    {mode !== "sec" && <div className="mb-4 rounded-lg bg-muted p-4 text-sm">{mode === "dynamic" ? "예시: 전체 매출 현황을 보여줘 · 담당자별 실적을 비교해줘 · 지역별 매출 비중을 보여줘" : fixedDemoCopy.examples}</div>}
    {mode === "sec" && <SecPromptGuide />}
    {mode === "sec" && <OutputTargetSelect value={outputTarget} onChange={setOutputTarget} />}
    {mode === "sec" && <SecFinancialShortcut />}
    <RunProgress agentId={`a2ui-${mode}`} compact={mode === "sec"} />
    {mode === "dynamic" && <><RenderModeSelect value={renderMode} onChange={setRenderMode} />{renderMode === "progressive" && <ProgressivePreview catalog={catalog} />}</>}
    <OutputWorkspace agentId={`a2ui-${mode}`} catalog={catalog} target={outputTarget}>
    <ChatViewport><CopilotChat welcomeScreen={mode === "sec" ? SecWelcome : undefined} agentId={`a2ui-${mode}`} labels={{ welcomeMessageText: mode === "sec" ? "SEC 공시 조회와 분석을 도와드립니다. 무엇이 궁금하세요?" : mode === "dynamic" ? "어떤 매출 정보를 살펴볼까요?" : fixedDemoCopy.welcome, chatInputPlaceholder: mode === "sec" ? "기능 질문, 회사 검색 또는 공시 분석 요청" : "질문을 입력하세요" }} /></ChatViewport>
    </OutputWorkspace>
  </CopilotKitProvider>;
}
