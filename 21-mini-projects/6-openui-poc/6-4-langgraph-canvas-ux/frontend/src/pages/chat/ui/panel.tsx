"use client";
import { useEffect, useState, type DragEvent } from "react";
import { Renderer } from "@openuidev/react-lang";
import { canvasLibrary, clampGrid, SnapshotContext, isRegistered, validateRegistered, RegisteredRenderer, CANVAS_MIME, writeCanvasDrag, useArtifacts, type CanvasWidget, type RegisteredWidget } from "@/entities/analysis";
import { useCanvas, getCanvasStore } from "@/features/manage-canvas";
import type { Widget } from "@/entities/analysis";
import "./workspace.css";
import {DashboardGrid} from "./dashboard-grid";
import {GridItem} from "./grid-item";

function AnalysisWidgetCard({widget:w}:{widget:Widget}){
 const threadId=useCanvas(s=>s.threadId);const owner=getCanvasStore(threadId);
 const tabs=useCanvas(s=>s.tabs);
 const selected=useCanvas(s=>s.selected);const select=useCanvas(s=>s.select);const edit=useCanvas(s=>s.edit);const refresh=useCanvas(s=>s.refresh);
 const pending=useCanvas(s=>s.pending[w.widgetId]);const running=useCanvas(s=>s.running);
 const refreshStatus=useCanvas(s=>s.refreshStatus[w.widgetId]);
 const [showData,setShowData]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(w.refreshPolicy!=="polling")return;
  const interval=setInterval(()=>{if(document.visibilityState==="visible"&&navigator.onLine&&!owner.getState().running&&Date.now()>=(owner.getState().refreshStatus[w.widgetId]?.nextAttemptAt||0))void refresh(w.widgetId);},w.intervalSeconds*1000);
  return()=>clearInterval(interval);
 },[w.refreshPolicy,w.intervalSeconds,w.widgetId,refresh,owner]);
 const age=now-Date.parse(w.snapshot.fetchedAt);
 return <GridItem widget={w} onDragOver={allowDrop} onDrop={e=>dropCanvas(e,w.widgetId)}>
  <header><DragHandle widget={w}/><button onClick={()=>select(w.widgetId)} aria-pressed={selected===w.widgetId}>선택: {w.title}</button><span className="canvas-badge">합성 데이터</span></header>
  <SnapshotContext.Provider value={w.snapshot}>
   <Renderer response={w.program} library={canvasLibrary} isStreaming={false} initialState={w.uiState} onStateUpdate={uiState=>edit(w.widgetId,{uiState})}/>
  </SnapshotContext.Provider>
  {w.parameters.start_date&&<p className="canvas-meta">고정 기간: {w.parameters.start_date} ~ {w.parameters.end_date}</p>}
  <div className="canvas-filters">
   <label>지역<select aria-label={`${w.title} 지역`} value={w.parameters.region} disabled={running} onChange={e=>{edit(w.widgetId,{parameters:{...w.parameters,region:e.target.value as "ALL"|"KR"|"US"}});void refresh(w.widgetId);}}><option value="ALL">전체</option><option value="KR">한국</option><option value="US">미국</option></select></label>
   <label>기간<select aria-label={`${w.title} 기간`} value={w.parameters.start_date?"fixed":w.parameters.months} disabled={running} onChange={e=>{edit(w.widgetId,{parameters:{...w.parameters,months:Number(e.target.value)}});void refresh(w.widgetId);}}>{w.parameters.start_date&&<option value="fixed" disabled>고정 기간</option>}{[1,3,6,12,24].map(n=><option key={n} value={n}>최근 {n}개월</option>)}</select></label>
   <label>갱신<select aria-label={`${w.title} 갱신 정책`} value={w.refreshPolicy} onChange={e=>edit(w.widgetId,{refreshPolicy:e.target.value as Widget["refreshPolicy"]})}><option value="manual">수동</option><option value="snapshot">Snapshot</option><option value="polling">{w.intervalSeconds}초마다</option></select></label>
  </div>
  <div className="canvas-actions">
   <button disabled={!!pending&&!pending.error||w.refreshPolicy==="snapshot"||running} onClick={()=>void refresh(w.widgetId)}>새로고침</button>
   <button onClick={()=>setShowData(v=>!v)} aria-expanded={showData}>데이터 보기</button>
   <button disabled={running} onClick={()=>owner.getState().move(w.widgetId)}>맨 위로</button>
   <button disabled={running} onClick={()=>owner.getState().remove(w.widgetId)}>삭제</button>
  </div>
  <div className="canvas-actions">
   <label>너비<select aria-label={`${w.title} 너비`} disabled={running} value={w.layout?.w||12} onChange={e=>edit(w.widgetId,{layout:{...w.layout,w:Number(e.target.value),h:w.layout?.h||14}})}>{Array.from({length:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}/24</option>)}</select></label>
   <label>높이<input aria-label={`${w.title} 높이`} type="range" min="4" max="40" step="1" disabled={running} value={w.layout?.h||14} onChange={e=>edit(w.widgetId,{layout:{...w.layout,w:w.layout?.w||12,h:Number(e.target.value)}})}/>{w.layout?.h||14}행</label>
   <label>탭 이동<select aria-label={`${w.title} 탭 이동`} disabled={running} value={w.tabId||"main"} onChange={e=>owner.getState().transfer(w.widgetId,e.target.value)}>{tabs.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
  </div>
  <p className="canvas-meta">조회: <time>{new Date(w.snapshot.fetchedAt).toLocaleString()}</time> · 데이터 v{w.snapshot.dataVersion}{age>60000?" · 오래된 조회 결과":""}</p>
  <p className="canvas-meta">원천 반영: {new Date(w.snapshot.sourceWatermark).toLocaleString()} · USD · UTC</p>
  <p className="canvas-meta">채팅 설명은 생성 당시 데이터 기준입니다.</p>
  {refreshStatus?.error&&<p role="status">{refreshStatus.error}{w.refreshPolicy==="polling"?" 자동 재시도 대기 중입니다.":""}</p>}
  {pending&&<p role="status">{pending.error||pending.message}</p>}
  {showData&&<div className="canvas-table"><table><caption>{w.title} 조회 결과</caption><thead><tr><th>기간</th><th>값</th></tr></thead><tbody>{w.snapshot.rows.map((row,i)=><tr key={i}><td>{row.period}</td><td>{row.value}</td></tr>)}</tbody></table></div>}
 </GridItem>;
}

function allowDrop(e:DragEvent){if(e.dataTransfer.types.includes(CANVAS_MIME)){e.preventDefault();e.stopPropagation();}}
function dropCanvas(e:DragEvent,beforeId?:string,tabId?:string){
 if(!e.dataTransfer.types.includes(CANVAS_MIME))return;e.preventDefault();e.stopPropagation();
 const state=useCanvas.getState();if(state.running||state.storageBlocked||state.disposed||!state.threadId)return;
 try{
  const raw=e.dataTransfer.getData(CANVAS_MIME);if(raw.length>100000)throw new Error("드래그 데이터가 너무 큽니다.");
  const payload=JSON.parse(raw);
  if(payload.version!==1||payload.threadId!==state.threadId)throw new Error("현재 채팅의 요소만 이동할 수 있습니다.");
  if(payload.type==="widget"){state.reorder(payload.widgetId,beforeId,tabId);return;}
  let candidateId:string|undefined;
  if(payload.type==="registered"){
   const content=validateRegistered(payload.content);if(tabId)state.selectTab(tabId);state.addRegistered(content);
   candidateId=useCanvas.getState().widgets.find(w=>isRegistered(w)&&w.sourceId===content.sourceId)?.widgetId;
  }else if(payload.type==="analysis"){
   const artifact=useArtifacts.getState().threads[state.threadId]?.[payload.artifactId];
   if(!artifact)throw new Error("분석 차트를 찾을 수 없습니다.");
   if(tabId)state.selectTab(tabId);state.addArtifact(artifact);
   candidateId=useCanvas.getState().widgets.find(w=>!isRegistered(w)&&w.sourceArtifactId===artifact.artifactId)?.widgetId;
  }else throw new Error("지원하지 않는 드래그 형식입니다.");
  if(candidateId&&beforeId)state.reorder(candidateId,beforeId,tabId);
  if(candidateId&&!tabId){
   const rect=e.currentTarget.closest('.canvas-panel')?.querySelector('.canvas-grid')?.getBoundingClientRect();
   const item=useCanvas.getState().widgets.find(w=>w.widgetId===candidateId);
   if(rect&&item&&e.clientY>=rect.top&&e.clientX>=rect.left&&e.clientX<=rect.right){
    state.edit(candidateId,{layout:clampGrid({...item.layout,x:Math.floor((e.clientX-rect.left)/((rect.width+8)/24)),y:Math.max(0,Math.floor((e.clientY-rect.top)/38))})});
   }
  }
 }catch{useCanvas.setState({notice:"Canvas에 놓을 수 없는 데이터입니다. 현재 채팅의 등록된 요소를 사용해주세요."});}
}
function DragHandle({widget}:{widget:CanvasWidget}){
 const state=useCanvas(s=>s);const disabled=state.running||state.storageBlocked;
 return <><button type="button" className="canvas-position-handle" disabled={disabled} aria-label={`${widget.title} 위치 이동`} title="드래그로 위치 이동 · 방향키로 이동" onKeyDown={e=>{
 const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!delta[e.key])return;e.preventDefault();const l=widget.layout??{w:12,h:14,x:0,y:0};const [dx,dy]=delta[e.key];state.edit(widget.widgetId,{layout:{...l,x:Math.max(0,Math.min(24-l.w,(l.x??0)+dx)),y:Math.max(0,(l.y??0)+dy)}});
 }}>⠿</button><button type="button" className="canvas-drag-handle" aria-label={`${widget.title} 이동`} disabled={disabled} draggable={!disabled} onDragStart={e=>{if(disabled||!state.threadId){e.preventDefault();return;}writeCanvasDrag(e,{version:1,threadId:state.threadId,type:"widget",widgetId:widget.widgetId});}} onKeyDown={e=>{
  if(!e.altKey||!["ArrowUp","ArrowDown"].includes(e.key)||disabled)return;e.preventDefault();
  const peers=state.widgets.filter(w=>(w.tabId||"main")===(widget.tabId||"main"));const i=peers.findIndex(w=>w.widgetId===widget.widgetId);
  if(e.key==="ArrowUp"&&i>0)state.reorder(widget.widgetId,peers[i-1].widgetId,widget.tabId);
  if(e.key==="ArrowDown"&&i<peers.length-1)state.reorder(widget.widgetId,peers[i+2]?.widgetId,widget.tabId);
 }} title="다른 탭으로 드래그 · Alt+위/아래로 순서 변경">↗</button></>;
}
function RegisteredWidgetCard({widget:w}:{widget:RegisteredWidget}){
 const state=useCanvas(s=>s);
 return <GridItem widget={w} onDragOver={allowDrop} onDrop={e=>dropCanvas(e,w.widgetId)}>
  <header><DragHandle widget={w}/><button onClick={()=>state.select(w.widgetId)} aria-pressed={state.selected===w.widgetId}>선택: {w.title}</button></header>
  <RegisteredRenderer content={w} onStateUpdate={uiState=>state.edit(w.widgetId,{uiState})}/>
  <div className="canvas-actions">
   <button disabled={state.running} onClick={()=>state.move(w.widgetId)}>맨 위로</button>
   <button disabled={state.running} onClick={()=>state.remove(w.widgetId)}>삭제</button>
   <label>너비<select aria-label={`${w.title} 너비`} disabled={state.running} value={w.layout.w} onChange={e=>state.edit(w.widgetId,{layout:{...w.layout,w:Number(e.target.value)}})}>{Array.from({length:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}/24</option>)}</select></label>
   <label>높이<input aria-label={`${w.title} 높이`} disabled={state.running} type="range" min="4" max="40" step="1" value={w.layout.h} onChange={e=>state.edit(w.widgetId,{layout:{...w.layout,h:Number(e.target.value)}})}/></label>
   <label>탭 이동<select aria-label={`${w.title} 탭 이동`} disabled={state.running} value={w.tabId} onChange={e=>state.transfer(w.widgetId,e.target.value)}>{state.tabs.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
  </div>
 </GridItem>;
}
function WidgetCard({widget}:{widget:CanvasWidget}){return isRegistered(widget)?<RegisteredWidgetCard widget={widget}/>:<AnalysisWidgetCard widget={widget}/>;}

export function CanvasPanel(){
 const threadId=useCanvas(s=>s.threadId);const tabs=useCanvas(s=>s.tabs);const activeTabId=useCanvas(s=>s.activeTabId);
 const legacyAvailable=useCanvas(s=>s.legacyAvailable);
 const running=useCanvas(s=>s.running);
 const fallbacks=useCanvas(s=>s.fallbacks);
 const widgets=useCanvas(s=>s.widgets);const pending=useCanvas(s=>s.pending);const notice=useCanvas(s=>s.notice);const hydrated=useCanvas(s=>s.hydrated);
 useEffect(()=>{useCanvas.getState().hydrate();},[]);
 return <aside onDragOver={allowDrop} onDrop={e=>dropCanvas(e)} className="canvas-panel" aria-label="Canvas 대시보드" aria-busy={running}>
  <header className="canvas-heading"><div><span className="canvas-eyebrow">ANALYTICS WORKSPACE</span><h2>Canvas <small>{widgets.length}개 위젯</small></h2></div><button onClick={()=>useCanvas.getState().persist()}>저장</button></header>
  <p className="canvas-help">채팅에서 “매출과 광고비 차트를 canvas에 만들어줘”라고 요청하세요. Chat의 등록된 카드를 끌어 놓거나 Add to Canvas로 추가하세요. ⠿ 핸들로 위치를 바꾸고, ↗로 다른 탭에 옮기세요. 카드 우하단 ↘를 끌어 그리드 크기를 조절하세요.</p>
  <div className="canvas-tabs" role="tablist" aria-label="Canvas 탭">{tabs.map(t=><button key={t.id} role="tab" onDragOver={allowDrop} onDrop={e=>dropCanvas(e,undefined,t.id)} aria-selected={t.id===activeTabId} onClick={()=>useCanvas.getState().selectTab(t.id)}>{t.title}</button>)}<button onClick={()=>useCanvas.getState().addTab()} disabled={tabs.length>=20}>탭 추가</button></div>
  <div className="canvas-actions"><label>탭 이름<input key={`${threadId}:${activeTabId}`} aria-label="탭 이름" defaultValue={tabs.find(t=>t.id===activeTabId)?.title} maxLength={80} onBlur={e=>useCanvas.getState().renameTab(activeTabId,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></label><button disabled={running} onClick={()=>{const count=widgets.filter(w=>(w.tabId||"main")===activeTabId).length;if(window.confirm(`이 탭과 포함된 패널 ${count}개를 삭제할까요?`))useCanvas.getState().removeTab(activeTabId);}}>탭 삭제</button></div>
  {legacyAvailable&&<button onClick={()=>useCanvas.getState().importLegacy()}>이전 공용 Canvas 가져오기</button>}
  {notice&&<p role="status" className="canvas-notice">{notice}</p>}
  {hydrated&&!widgets.some(w=>(w.tabId||"main")===activeTabId)&&!fallbacks.length&&!Object.keys(pending).length&&<div className="canvas-empty"><span>＋</span><h3>대화에서 시작하는 대시보드</h3><p>차트를 만들고, 필요한 데이터만 갱신하세요.</p><p>데이터는 DuckDB 합성 데이터입니다.</p></div>}
  {fallbacks.map((item,index)=><section key={index} className="canvas-widget" aria-label={`${item.title} 복구 데이터`}><h3>{item.title}</h3><p>저장 당시 데이터 · 읽기 전용 대체 표시</p><div className="canvas-table"><table><caption>{item.title} 저장 데이터</caption><thead><tr><th>기간</th><th>값</th></tr></thead><tbody>{item.snapshot.rows.map((row,i)=><tr key={i}><td>{row.period}</td><td>{row.value}</td></tr>)}</tbody></table></div></section>)}
  <DashboardGrid widgets={widgets.filter(w=>(w.tabId||"main")===activeTabId)} render={w=><WidgetCard widget={w}/>}/>
  <div className="canvas-pending">
   {Object.entries(pending).filter(([id,p])=>(p.tabId||"main")===activeTabId&&!widgets.some(w=>w.widgetId===id)).map(([id,p])=><article className="canvas-widget" key={id}><h3>{p.title}</h3><p role="status">{p.error||p.message}</p>{p.program&&!p.error&&<SnapshotContext.Provider value={p.snapshot||null}><Renderer response={p.program} library={canvasLibrary} isStreaming/></SnapshotContext.Provider>}{p.error&&<button onClick={()=>useCanvas.getState().remove(id)}>닫기</button>}</article>)}
  </div>
 </aside>;
}
