"use client";

import { defineComponent, useStateField } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { FinancialChartMetadataView } from "./financial-chart-metadata";
import { FinancialChartPlotView } from "./financial-chart-plot";
import { FinancialChartSummaryView } from "./financial-chart-summary";
import { financialSnapshotSchema } from "./financial-schema";
import { useFinancialVisibility, type FinancialVisibilityProps } from "./financial-visibility";
export type { FinancialSnapshot } from "./financial-schema";
export { FinancialChartPlot, FinancialChartPlotView } from "./financial-chart-plot";
export { FinancialChartSummary, FinancialChartSummaryView } from "./financial-chart-summary";
export { FinancialChartMetadata, FinancialChartMetadataView } from "./financial-chart-metadata";

export function FinancialChartView(props: FinancialVisibilityProps) {
  const { snapshot, indicators, visible, selectionError, toggle } = useFinancialVisibility(props);
  const visibility = Object.fromEntries(indicators.map(item => [item.instanceId, visible.some(shown => shown.instanceId === item.instanceId)]));
  return <div className="iui-financial-composite" style={{ minWidth: 0 }}>
    <FinancialChartPlotView snapshot={snapshot} visibility={visibility} />
    <FinancialChartSummaryView snapshot={snapshot} visible={visible} selectionError={selectionError} onVisibilityChange={toggle} />
    <FinancialChartMetadataView snapshot={snapshot} />
  </div>;
}

export const FinancialChart = defineComponent({
  name: "FinancialChart", props: z.object({ snapshot: financialSnapshotSchema }),
  description: "Verified financial plot with collapsed indicator summary and data provenance. Indicator controls preserve local visibility and up to four oscillator panes. Use FinancialChartPlot, FinancialChartSummary and FinancialChartMetadata for custom composition.",
  component: function FinancialChartComponent({ props, statementId }) {
    const field = useStateField<Record<string, boolean>>(`${statementId ?? "financial-chart"}.visibility`, {});
    return <FinancialChartView snapshot={props.snapshot} visibility={field.value} onVisibilityChange={value => field.setValue(value)} />;
  },
});
