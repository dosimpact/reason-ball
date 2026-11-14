"use client";

import React, { useMemo } from "react";
import { FieldType, toDataFrame, type FieldSparkline } from "@grafana/data";
import { Sparkline, PlotLegend, UPlotConfigBuilder, useTheme2 } from "@grafana/ui";
import type { Config } from "./catalog";

export const visualizationNames = new Set(["Sparkline", "PlotLegend"]);

/** Build real Grafana Fields: raw values alone omit config/type required by prepareSeries. */
export function SagaVisualization({ name, config }: { name: string; config: Config }) {
  return name === "PlotLegend" ? <SagaPlotLegend config={config}/> : <SagaSparkline config={config}/>;
}

function SagaSparkline({ config }: { config: Config }) {
  const theme = useTheme2();
  const values = config.values as number[];
  const sparkline = useMemo<FieldSparkline>(() => ({
    x: { name: "Sample index", type: FieldType.number, config: {}, values: values.map((_, index) => index) },
    y: { name: "Sample value", type: FieldType.number, config: { color: { mode: "fixed", fixedColor: "blue" } }, state: { range: { min: Math.min(...values), max: Math.max(...values), delta: Math.max(...values) - Math.min(...values) } }, values },
  }), [values]);
  return <div aria-label="Sample sparkline" style={{ width: Number(config.width), maxWidth: "100%" }}><Sparkline width={Number(config.width)} height={Number(config.height)} theme={theme} sparkline={sparkline} showTooltip /></div>;
}


function SagaPlotLegend({ config }: { config: Config }) {
  const theme = useTheme2();
  const items = config.items as Array<{ label: string; color: string }>;
  const { data, builder } = useMemo(() => {
    const frame = toDataFrame({ fields: items.map((item, index) => ({
      name: item.label, type: FieldType.number, values: [index + 2, index + 4, index + 3],
      config: { color: { mode: "fixed", fixedColor: item.color } },
    })) });
    const builder = new UPlotConfigBuilder("utc");
    builder.addScale({ scaleKey: "y", orientation: 1, direction: 1 });
    frame.fields.forEach((field, index) => builder.addSeries({
      scaleKey: "y", theme, lineColor: items[index].color, lineWidth: 2,
      dataFrameFieldIndex: { frameIndex: 0, fieldIndex: index },
    }));
    return { data: [frame], builder };
  }, [items, theme]);
  return <PlotLegend showLegend data={data} config={builder} placement="bottom" displayMode={"list" as React.ComponentProps<typeof PlotLegend>["displayMode"]} calcs={[]}/>;
}
