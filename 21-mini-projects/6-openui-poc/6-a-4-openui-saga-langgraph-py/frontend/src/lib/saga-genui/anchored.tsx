"use client";
import React, { useState } from "react";
import { Button, InlineToast, Popover, Portal, VizTooltip, VizTooltipContainer, VizTooltipContent } from "@grafana/ui";
import type { Config } from "./catalog";
/** A local DOM anchor and owned visibility make portal-based exports runnable standalone. */
export function SagaAnchored({ name, config }: { name: string; config: Config }) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  if (name === "VizTooltip" || name === "VizTooltipContainer") return <div style={{ minHeight: 80 }} ref={setAnchor}><Button onClick={() => setOpen(!open)}>Show sample tooltip</Button>{anchor && open && (name === "VizTooltip" ? <VizTooltip position={{ x: anchor.getBoundingClientRect().left, y: anchor.getBoundingClientRect().bottom }} content={<VizTooltipContent items={[{label: String(config.label), value: String(config.value), color: "green"}]} />} /> : <VizTooltipContainer position={{ x: anchor.getBoundingClientRect().left, y: anchor.getBoundingClientRect().bottom }} offset={{x: 0, y: 0}}>{String(config.text)}</VizTooltipContainer>)}</div>;
  if (name === "Portal") return <div ref={setAnchor} style={{ minHeight: 36 }}>{anchor && <Portal root={anchor}>{String(config.text)}</Portal>}</div>;
  return <div ref={setAnchor} style={{ minHeight: 72, padding: 16 }}><Button onClick={() => setOpen(!open)}>{name === "Popover" ? "Show information" : "Show notification"}</Button>{anchor && open && (name === "Popover" ? <Popover show content={String(config.content ?? config.text)} referenceElement={anchor} placement="bottom" /> : <InlineToast referenceElement={anchor} placement="bottom">{String(config.text)}</InlineToast>)}</div>;
}
