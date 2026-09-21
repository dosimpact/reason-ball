"use client";

import { useEffect, useMemo, useState } from "react";
import { A2UIProvider, A2UIRenderer, useA2UIActions, useA2UIError } from "@copilotkit/a2ui-renderer";
import bothSchema from "../../../../3-langgraph-fast/src/graph/primary_graphs/a2ui_demo/schemas/cabin.json";
import mealSchema from "../../../../3-langgraph-fast/src/graph/primary_graphs/a2ui_demo/schemas/meal.json";
import seatSchema from "../../../../3-langgraph-fast/src/graph/primary_graphs/a2ui_demo/schemas/seat.json";
import { createHostCatalog } from "./catalog";
import { catalogId } from "./definitions";

type UIType = "meal" | "seat" | "both";

export function CabinPreview({ uiType = "both" }: { uiType?: UIType }) {
  const catalog = useMemo(() => createHostCatalog("fixed"), []);
  const [action, setAction] = useState("");
  return <A2UIProvider catalog={catalog} onAction={event => setAction(JSON.stringify(event))}><div className="max-w-xl p-4"><CabinSurface uiType={uiType} /><output aria-label="기내 선택 action">{action}</output></div></A2UIProvider>;
}

function CabinSurface({ uiType }: { uiType: UIType }) {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const error = useA2UIError();
  useEffect(() => {
    processMessages([
      { version: "v0.9", createSurface: { surfaceId: "cabin-story", catalogId: catalogId("fixed") } },
      { version: "v0.9", updateComponents: { surfaceId: "cabin-story", components: { meal: mealSchema, seat: seatSchema, both: bothSchema }[uiType] } },
      { version: "v0.9", updateDataModel: { surfaceId: "cabin-story", path: "/", value: {
        flightId: "demo-nrt-icn", flightLabel: "NRT → ICN · Demo Air", meal: "standard", seat: "12A",
        confirmed: false, status: "기내식과 좌석을 선택하세요.", buttonLabel: "선택 확정",
      } } },
    ]);
    return clearSurfaces;
  }, [processMessages, clearSurfaces, uiType]);
  return <>{error && <p role="alert">{error}</p>}<A2UIRenderer surfaceId="cabin-story" /></>;
}
