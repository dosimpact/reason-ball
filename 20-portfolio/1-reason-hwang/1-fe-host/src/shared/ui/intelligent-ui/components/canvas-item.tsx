"use client";

import { createContext, useContext } from "react";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { children } from "./style";

export type CanvasAddHandler = (id: string) => void;
export const CanvasAddContext = createContext<CanvasAddHandler | null>(null);

export const CanvasItem = defineComponent({
  name: "CanvasItem",
  props: z.object({ id: z.string().min(1), title: z.string().min(1), children }),
  description: "A selectable inline result. Canvas users can pin this child UI by clicking Add to Canvas; id must be stable and unique within the response. Keep controls, chart, and explanatory content needed by this item together in children.",
  component: function CanvasItemView({ props, renderNode }) {
    const onAdd = useContext(CanvasAddContext);
    return <section className="iui-canvas-item" aria-label={props.title}>
      {onAdd && <div className="iui-canvas-item-toolbar"><button type="button" className="iui-button iui-button-outline" onClick={() => onAdd(props.id)}>Canvas에 추가</button></div>}
      {renderNode(props.children)}
    </section>;
  },
});
