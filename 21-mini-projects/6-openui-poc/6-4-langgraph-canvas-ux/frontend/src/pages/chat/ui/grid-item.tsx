"use client";
import type {ReactNode,DragEventHandler} from 'react';
import type {CanvasWidget} from '@/entities/analysis';
import {useCanvas} from '@/features/manage-canvas';
export function GridItem({widget,children,onDrop,onDragOver}:{widget:CanvasWidget;children:ReactNode;onDrop:DragEventHandler;onDragOver:DragEventHandler}){
 const selected=useCanvas(s=>s.selected);const layout=widget.layout??{w:12,h:14};
 return <article className={`canvas-widget ${selected===widget.widgetId?'selected':''}`} data-testid="canvas-widget" data-widget-id={widget.widgetId} onDrop={onDrop} onDragOver={onDragOver}>
  <div className="canvas-widget-content">{children}</div>
  <span className="canvas-grid-size">{layout.w} × {layout.h}</span>
 </article>;
}
