"use client";

import { defineComponent, useStateField } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { FinancialChartCanvas } from "./financial-chart-canvas";
import { financialSnapshotSchema } from "./financial-schema";
import { useFinancialVisibility, type FinancialVisibilityProps } from "./financial-visibility";

export function FinancialChartPlotView(props: FinancialVisibilityProps) {
  const { snapshot, visible } = useFinancialVisibility(props);
  return <figure className="iui-financial-chart" style={{ margin: 0, minWidth: 0 }} aria-label={`${snapshot.symbol ?? "Financial"} candlestick chart`}>
    <figcaption><strong>{[snapshot.symbol, snapshot.interval, snapshot.currency].filter(Boolean).join(" · ")}</strong></figcaption>
    <FinancialChartCanvas snapshot={snapshot} visible={visible} />
    {snapshot.warnings?.map(warning => <p key={warning} role="status">{warning}</p>)}
    <div><small>TradingView Lightweight Charts™ · Copyright © 2025 TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></small></div>
  </figure>;
}

export const FinancialChartPlot = defineComponent({
  name: "FinancialChartPlot", props: z.object({ snapshot: financialSnapshotSchema, visibilityKey: z.string().optional() }),
  description: "Verified price and volume plot with server-computed indicator overlays and up to four oscillator panes. No metadata or indicator summary. Never invent series values.",
  component: function FinancialChartPlotComponent({ props, statementId }) {
    const field = useStateField<Record<string, boolean>>(`${props.visibilityKey ?? statementId ?? "financial-chart-plot"}.visibility`, {});
    return <FinancialChartPlotView snapshot={props.snapshot} visibility={field.value} />;
  },
});
