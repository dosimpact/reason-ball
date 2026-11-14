"use client";

import { action, defineComponent, useIsQueryLoading, useIsStreaming, useTriggerAction } from "@openuidev/react-lang";
import { RefreshCw } from "lucide-react";
import { z } from "zod/v4";
import { children } from "./style";

type RefreshAction = Parameters<ReturnType<typeof useTriggerAction>>[2];

export const QueryPanel = defineComponent({
  name: "QueryPanel",
  props: z.object({ children, refreshAction: action() }),
  description: "Group editable Query argument controls and their data component together. Always pass Action([@Run(queryStatement)]) as refreshAction; the accessible refresh icon reruns that exact Query without changing arguments or calling the assistant. Include labelled controls before the data view.",
  component: function QueryPanelView({ props, renderNode }) {
    const trigger = useTriggerAction();
    const loading = useIsQueryLoading();
    const streaming = useIsStreaming();
    return <section className="iui-query-panel" aria-label="데이터 조회" aria-busy={loading}>
      <header className="iui-query-panel-header">
        <strong>조회 조건</strong>
        <div className="iui-query-panel-refresh">
          {loading && <span role="status">조회 중…</span>}
          <button type="button" className="iui-icon-button iui-icon-button-outline" aria-label="데이터 새로고침" title="현재 조건으로 새로고침" disabled={loading || streaming} onClick={() => {
            if (!loading && !streaming) void trigger("", undefined, props.refreshAction as RefreshAction);
          }}>
            <RefreshCw size={16} aria-hidden="true" className={loading ? "iui-query-panel-spinner" : undefined} />
          </button>
        </div>
      </header>
      <div className="iui-query-panel-content">{renderNode(props.children)}</div>
    </section>;
  },
});
