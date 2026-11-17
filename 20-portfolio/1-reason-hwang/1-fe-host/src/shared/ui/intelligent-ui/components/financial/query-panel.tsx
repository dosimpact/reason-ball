"use client";

import { action, defineComponent, useIsQueryLoading, useIsStreaming, useTriggerAction, type ElementNode } from "@openuidev/react-lang";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod/v4";
import { children } from "../style";

type RefreshAction = Parameters<ReturnType<typeof useTriggerAction>>[2];
const CONTROL_TYPES = new Set(["Input", "TextArea", "Select", "Slider", "Checkbox", "RadioGroup", "DatePicker", "IndicatorControls", "Button", "IconButton"]);
const LAYOUT_TYPES = new Set(["Box", "Row", "Col", "Grid", "Card", "Form"]);

function isElementNode(node: unknown): node is ElementNode {
  return typeof node === "object" && node !== null && "type" in node && node.type === "element" && "typeName" in node && typeof node.typeName === "string" && "props" in node && typeof node.props === "object" && node.props !== null;
}

/** Partition legacy SDK nodes, retaining layout around each branch of mixed rows. */
export function partitionQueryChildren(nodes: unknown[]): { controls: unknown[]; data: unknown[] } {
  const controls: unknown[] = [];
  const data: unknown[] = [];
  for (const node of nodes) {
    if (isElementNode(node) && CONTROL_TYPES.has(node.typeName)) {
      controls.push(node);
    } else if (isElementNode(node) && LAYOUT_TYPES.has(node.typeName) && Array.isArray(node.props.children)) {
      const nested = partitionQueryChildren(node.props.children);
      if (nested.controls.length) controls.push({ ...node, props: { ...node.props, children: nested.controls } });
      if (nested.data.length) data.push({ ...node, props: { ...node.props, children: nested.data } });
    } else {
      data.push(node);
    }
  }
  return { controls, data };
}

export function QueryPanelFrame({ children, controls, loading = false, disabled = false, onRefresh }: {
  children: ReactNode; controls?: ReactNode; loading?: boolean; disabled?: boolean; onRefresh: () => void;
}) {
  return <section className="iui-query-panel" aria-label="데이터 조회" aria-busy={loading}>
    <header className="iui-query-panel-header">
      <strong>데이터 조회</strong>
      <div className="iui-query-panel-refresh">
        {loading && <span role="status">조회 중…</span>}
        <button type="button" className="iui-icon-button iui-icon-button-outline" aria-label="데이터 새로고침" title="현재 조건으로 새로고침" disabled={loading || disabled} onClick={onRefresh}>
          <RefreshCw size={16} aria-hidden="true" className={loading ? "iui-query-panel-spinner" : undefined} />
        </button>
      </div>
    </header>
    {controls && <details className="iui-query-panel-settings">
      <summary><SlidersHorizontal size={14} aria-hidden="true" />조회 조건</summary>
      <div className="iui-query-panel-controls">{controls}</div>
    </details>}
    <div className="iui-query-panel-data">{children}</div>
  </section>;
}

export const QueryPanel = defineComponent({
  name: "QueryPanel",
  props: z.object({ children, refreshAction: action(), controls: children.optional() }),
  description: "Financial Query panel with an always-visible data view and refresh button. Pass data components as children and labelled Query argument fields as optional third controls argument; controls start collapsed under 조회 조건. Always pass Action([@Run(queryStatement)]) as refreshAction. Legacy mixed children remain supported; charts stay visible while inputs are collapsed.",
  component: function QueryPanelView({ props, renderNode }) {
    const trigger = useTriggerAction();
    const loading = useIsQueryLoading();
    const streaming = useIsStreaming();
    const split = props.controls === undefined ? partitionQueryChildren(props.children) : { data: props.children, controls: props.controls };
    return <QueryPanelFrame loading={loading} disabled={streaming}
      controls={split.controls.length ? renderNode(split.controls) : undefined}
      onRefresh={() => { if (!loading && !streaming) void trigger("", undefined, props.refreshAction as RefreshAction); }}>
      {renderNode(split.data)}
    </QueryPanelFrame>;
  },
});
