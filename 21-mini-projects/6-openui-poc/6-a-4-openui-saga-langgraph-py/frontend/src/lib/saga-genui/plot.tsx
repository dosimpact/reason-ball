"use client";
import React, { useMemo } from "react";
import * as UI from "@grafana/ui";
import { EventBusSrv, toDataFrame } from "@grafana/data";
import type { Config } from "./catalog";

export const plotNames = new Set("UPlotChart XYCanvas EventsCanvas Marker TooltipPlugin2 EventBusPlugin KeyboardPlugin XAxisInteractionAreaPlugin".split(" "));
/** Plugins receive a real owned plot/config/event bus rather than Grafana server contexts. */
export function SagaPlot({ name, config }: { name: string; config: Config }) {
  const theme = UI.useTheme2();
  const builder = useMemo(() => {
    const result = new UI.UPlotConfigBuilder("utc");
    result.addScale({ scaleKey: "x", isTime: false, orientation: 0, direction: 1 });
    result.addScale({ scaleKey: "y", orientation: 1, direction: 1 });
    result.addSeries({ scaleKey: "y", theme, lineColor: "#5794f2", lineWidth: 2 });
    return result;
  }, [theme]);
  const bus = useMemo(() => new EventBusSrv(), []);
  const values = config.values as number[];
  const data: [number[], number[]] = [values.map((_, index) => index), values];
  let child: React.ReactNode;
  if (name === "KeyboardPlugin") child = <UI.KeyboardPlugin config={builder} />;
  if (name === "EventBusPlugin") child = <UI.EventBusPlugin config={builder} eventBus={bus} />;
  if (name === "XAxisInteractionAreaPlugin") child = <UI.XAxisInteractionAreaPlugin config={builder} />;
  if (name === "TooltipPlugin2") child = <UI.TooltipPlugin2 config={builder} hoverMode={0} render={() => <UI.Text>Sample point</UI.Text>} />;
  if (name === "Marker") child = <UI.Marker x={80} y={60}><UI.Badge text="Sample event" color="blue" /></UI.Marker>;
  if (name === "XYCanvas") child = <UI.XYCanvas top={20} left={30}><UI.Text>Sample overlay</UI.Text></UI.XYCanvas>;
  if (name === "EventsCanvas") child = <UI.EventsCanvas id="saga-sample-events" config={builder} events={[toDataFrame({ fields: [{ name: "time", values: [2] }] })]} mapEventToXYCoords={() => ({x: 80, y: 60})} renderEventMarker={() => <UI.Badge text="Event" color="blue" />} />;
  return <UI.UPlotChart data={data} width={Number(config.width)} height={Number(config.height)} config={builder}>{child}</UI.UPlotChart>;
}
