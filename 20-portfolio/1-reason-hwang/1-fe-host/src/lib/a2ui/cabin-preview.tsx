"use client";

import { useEffect, useMemo, useState } from "react";
import { A2UIProvider, A2UIRenderer, useA2UIActions, useA2UIError } from "@copilotkit/a2ui-renderer";
import schema from "../../../../3-langgraph-fast/src/graph/primary_graphs/a2ui_demo/schemas/cabin.json";
import { createHostCatalog } from "./catalog";
import { catalogId } from "./definitions";

export function CabinPreview() {
  const catalog = useMemo(() => createHostCatalog("fixed"), []);
  const [action, setAction] = useState("");
  return <A2UIProvider catalog={catalog} onAction={event => setAction(JSON.stringify(event))}><div className="max-w-xl p-4"><CabinSurface /><output aria-label="기내 선택 action">{action}</output></div></A2UIProvider>;
}

function CabinSurface() {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const error = useA2UIError();
  useEffect(() => {
    processMessages([
      { version: "v0.9", createSurface: { surfaceId: "cabin-story", catalogId: catalogId("fixed") } },
      { version: "v0.9", updateComponents: { surfaceId: "cabin-story", components: schema } },
      { version: "v0.9", updateDataModel: { surfaceId: "cabin-story", path: "/", value: {
        flightId: "demo-nrt-icn", flightLabel: "NRT → ICN · Demo Air", meal: "standard", seat: "12A",
        confirmed: false, status: "기내식과 좌석을 선택하세요.", buttonLabel: "선택 확정",
      } } },
    ]);
    return clearSurfaces;
  }, [processMessages, clearSurfaces]);
  return <>{error && <p role="alert">{error}</p>}<A2UIRenderer surfaceId="cabin-story" /></>;
}
