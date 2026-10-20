"use client";
import {useEffect,useRef,useState,type ReactNode,type Ref} from 'react';
import ReactGridLayout,{useContainerWidth,verticalCompactor,type Layout} from 'react-grid-layout';
import {useCanvas,getCanvasStore} from '@/features/manage-canvas';
import type {CanvasWidget} from '@/entities/analysis';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
export function DashboardGrid({widgets,render}:{widgets:CanvasWidget[];render:(w:CanvasWidget)=>ReactNode}){
 const {width,containerRef,mounted}=useContainerWidth();
 const state=useCanvas(s=>s);const owner=getCanvasStore(state.threadId);
 const [epoch,setEpoch]=useState(0);const cancelled=useRef(false);const active=useRef(false);
 useEffect(()=>{const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&active.current){active.current=false;cancelled.current=true;setEpoch(v=>v+1);}};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[]);
 const narrow=width<600;const disabled=state.running||state.storageBlocked||narrow;
 const layout:Layout=widgets.map((w,i)=>({i:w.widgetId,x:narrow?0:w.layout?.x??0,y:narrow?widgets.slice(0,i).reduce((s,w)=>s+(w.layout?.h??14),0):w.layout?.y??0,w:narrow?24:w.layout?.w??12,h:w.layout?.h??14,minW:1,maxW:24,minH:4,maxH:40}));
 const save=(next:Layout)=>{active.current=false;if(cancelled.current){cancelled.current=false;return;}owner.getState().setLayouts(state.activeTabId,next.map(({i,x,y,w,h})=>({id:i,layout:{x,y,w,h}})));};
 return <div ref={containerRef} className="canvas-grid">
  {mounted&&<ReactGridLayout key={`${state.threadId}:${state.activeTabId}:${epoch}`} width={width} layout={layout}
   gridConfig={{cols:24,rowHeight:30,margin:[8,8],containerPadding:[0,0]}} compactor={verticalCompactor}
   dragConfig={{enabled:!disabled,handle:'.canvas-position-handle'}}
   resizeConfig={{enabled:!disabled,handles:['se'],handleComponent:(_axis,ref)=><span ref={ref as Ref<HTMLSpanElement>} className="react-resizable-handle react-resizable-handle-se" role="img" aria-label="패널 크기 조절" title="드래그로 크기 조절 · Escape 취소"/>}}
   onDragStart={()=>{active.current=true;cancelled.current=false;}} onResizeStart={()=>{active.current=true;cancelled.current=false;}}
   onDragStop={save} onResizeStop={save}
  >{widgets.map(w=><div key={w.widgetId} className="canvas-grid-slot">{render(w)}</div>)}</ReactGridLayout>}
 </div>;
}
