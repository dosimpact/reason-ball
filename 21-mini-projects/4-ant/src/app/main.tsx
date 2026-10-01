import React from "react";
import { createRoot } from "react-dom/client";
import { GameWidget } from "../widgets/game";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GameWidget />
  </React.StrictMode>,
);
