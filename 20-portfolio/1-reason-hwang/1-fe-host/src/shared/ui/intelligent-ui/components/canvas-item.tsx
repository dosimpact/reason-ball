"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { children } from "./style";

export type CanvasAddHandler = (id: string) => void;
export const CanvasAddContext = createContext<CanvasAddHandler | null>(null);

export interface CanvasItemFrameProps {
  title: string;
  children: ReactNode;
  onAdd?: () => void;
}

/** Shared React frame; the OpenUI adapter below only supplies rendered children. */
export function CanvasItemFrame({ title, children, onAdd }: CanvasItemFrameProps) {
  if (!onAdd) return <section className="iui-canvas-item" aria-label={title}>{children}</section>;

  return <div className="iui-canvas-item-frame">
    <section className="iui-canvas-item iui-canvas-item-selectable" aria-label={title}>
      <button type="button" className="iui-button iui-button-solid iui-button-sm iui-canvas-item-add" onClick={onAdd}>
        <span aria-hidden="true">+</span> Canvas에 추가
      </button>
      {children}
    </section>
  </div>;
}

export const CanvasItem = defineComponent({
  name: "CanvasItem",
  props: z.object({ id: z.string().min(1), title: z.string().min(1), children }),
  description: "A selectable inline result. Canvas users can pin this child UI by clicking Add to Canvas; id must be stable and unique within the response. Keep controls, chart, and explanatory content needed by this item together in children.",
  component: function CanvasItemView({ props, renderNode }) {
    const onAdd = useContext(CanvasAddContext);
    return <CanvasItemFrame title={props.title} onAdd={onAdd ? () => onAdd(props.id) : undefined}>
      {renderNode(props.children)}
    </CanvasItemFrame>;
  },
});
