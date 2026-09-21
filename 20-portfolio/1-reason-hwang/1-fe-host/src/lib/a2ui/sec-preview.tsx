"use client";

import { useEffect, useMemo, useState } from "react";
import { A2UIProvider, A2UIRenderer, useA2UIActions, useA2UIError } from "@copilotkit/a2ui-renderer";
import { createHostCatalog } from "./catalog";
import { catalogId } from "./definitions";

export function SecPreview({ operations }: { operations?: Record<string, unknown>[] } = {}) {
  const catalog = useMemo(() => createHostCatalog("sec"), []);
  const [action, setAction] = useState("");
  return <A2UIProvider catalog={catalog} onAction={event => setAction(JSON.stringify(event))}><div className="max-w-xl p-4"><SecSurface operations={operations} /><output aria-label="SEC action">{action}</output></div></A2UIProvider>;
}

function SecSurface({ operations }: { operations?: Record<string, unknown>[] }) {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const error = useA2UIError();
  useEffect(() => {
    processMessages(operations ?? [
      { version: "v0.9", createSurface: { surfaceId: "sec-story", catalogId: catalogId("sec") } },
      { version: "v0.9", updateComponents: { surfaceId: "sec-story", components: [
        { id: "root", component: "Column", children: ["query", "search", "report"] },
        { id: "query", component: "Input", label: "회사명 또는 티커", value: { path: "/query" } },
        { id: "search", component: "Button", label: "회사 검색", action: { event: { name: "sec_search", context: { query: { path: "/query" }, page: 1, revision: 1 } } } },
        { id: "report", component: "Accordion", items: [{ title: "핵심 요약", text: "기업 고객에게 서비스를 제공합니다.\n[E1] The company provides services to enterprise customers." }, { title: "재무 분석", text: "제공된 발췌에서 확인된 정보가 없습니다." }] },
      ] } },
      { version: "v0.9", updateDataModel: { surfaceId: "sec-story", path: "/", value: { query: "" } } },
    ]);
    return clearSurfaces;
  }, [operations, processMessages, clearSurfaces]);
  return <>{error && <p role="alert">{error}</p>}<A2UIRenderer surfaceId="sec-story" /></>;
}
