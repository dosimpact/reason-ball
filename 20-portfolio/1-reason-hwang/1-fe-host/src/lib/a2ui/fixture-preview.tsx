"use client";

import { useEffect, useMemo, useState } from "react";
import { A2UIProvider, A2UIRenderer, useA2UIActions, useA2UIError } from "@copilotkit/a2ui-renderer";
import { createHostCatalog } from "./catalog";
import { fixtureOperations } from "./fixtures";
import type { ComponentName } from "./definitions";

export function FixturePreview({ name, dataModel }: { name: ComponentName; dataModel?: Record<string, unknown> }) {
  const catalog = useMemo(() => createHostCatalog("host"), []);
  const [action, setAction] = useState("");
  return <A2UIProvider catalog={catalog} onAction={message => setAction(JSON.stringify(message))}><div className="w-full max-w-2xl space-y-4 p-4"><FixtureSurface name={name} dataModel={dataModel} /><output aria-label="최근 action" className="block break-all text-xs">{action}</output></div></A2UIProvider>;
}

function FixtureSurface({ name, dataModel }: { name: ComponentName; dataModel?: Record<string, unknown> }) {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const error = useA2UIError();
  useEffect(() => {
    clearSurfaces();
    const operations: Record<string, unknown>[] = fixtureOperations(name);
    if (dataModel) (operations[2].updateDataModel as { value: unknown }).value = dataModel;
    // Add a submit control to all fixtures to inspect the latest bound value.
    const update = operations[1].updateComponents as { components: Record<string, unknown>[] };
    update.components[0].id = "fixture-control";
    update.components.push(
      { id: "root", component: "Column", children: ["fixture-control", "fixture-submit"] },
      { id: "fixture-submit", component: "Button", label: "바인딩 확인", action: { event: { name: "demo_submit", context: { value: { path: "/value" }, text: { path: "/text" }, checked: { path: "/checked" }, date: { path: "/date" }, page: { path: "/page" }, progress: { path: "/progress" } } } } },
    );
    processMessages(operations);
    return clearSurfaces;
  }, [name, dataModel, processMessages, clearSurfaces]);
  return <>{error && <p role="alert" data-testid="a2ui-error">{error}</p>}<div data-testid="a2ui-fixture"><A2UIRenderer surfaceId={`fixture-${name}`} /></div></>;
}
