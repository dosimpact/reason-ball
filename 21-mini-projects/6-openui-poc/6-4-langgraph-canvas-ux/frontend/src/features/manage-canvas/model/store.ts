"use client";
import {canvasWidgetSchema,isRegistered,validateRegistered,type CanvasWidget,type RegisteredContent,hydrateArtifacts,removeArtifacts} from "@/entities/analysis";
import {artifactSchema,type ChartArtifact} from "@/entities/analysis";
import {normalizeWidgets} from "./layout";
import {gridLayoutSchema,clampGrid,type GridLayout} from "@/entities/analysis";
import { create } from "zustand";
import { documentSchema, threadCanvasKey, ACTIVE_THREAD_KEY, type CanvasTab, fallbackSnapshots, type FallbackSnapshot, restore, snapshotSchema, STORAGE_KEY, widgetSchema, type CanvasEvent, type Pending } from "@/entities/analysis";
import { validProgram } from "@/entities/analysis";

export type State={setLayouts:(tabId:string,layouts:Array<{id:string;layout:GridLayout}>)=>void;addRegistered:(content:RegisteredContent)=>void;reorder:(id:string,beforeId?:string,tabId?:string)=>void;removeSource:(sourceId:string)=>void;addArtifact:(artifact:ChartArtifact)=>void;threadId:string|null;disposed:boolean;tabs:CanvasTab[];activeTabId:string;legacyAvailable:boolean;
 addTab:()=>void;renameTab:(id:string,title:string)=>void;removeTab:(id:string)=>void;selectTab:(id:string)=>void;transfer:(id:string,tabId:string)=>void;importLegacy:()=>void;
fallbacks:FallbackSnapshot[];widgets:CanvasWidget[];selected:string|null;pending:Record<string,Pending>;notice:string;hydrated:boolean;running:boolean;storageBlocked:boolean;refreshStatus:Record<string,{failures:number;nextAttemptAt:number;error:string}>;
  hydrate:()=>void;persist:()=>void;select:(id:string)=>void;event:(e:CanvasEvent)=>void;finish:(runId?:string)=>void;
  refresh:(id:string)=>Promise<void>;edit:(id:string,patch:Partial<CanvasWidget>)=>void;remove:(id:string)=>void;move:(id:string)=>void;};
function createCanvasStore(threadId:string|null){
const requests=new Map<string,string>();
const sequences=new Map<string,number>();
const retiredRuns=new Set<string>();
return create<State>((set,get)=>({
 setLayouts(tabId,layouts){
  if(get().running||get().storageBlocked||get().disposed)return;
  const peers=get().widgets.filter(w=>(w.tabId||"main")===tabId);
  if(layouts.length!==peers.length||new Set(layouts.map(l=>l.id)).size!==peers.length||layouts.some(l=>!peers.some(w=>w.widgetId===l.id)))return;
  const parsed=new Map(layouts.map(l=>[l.id,gridLayoutSchema.parse(l.layout)]));
  set(s=>({widgets:normalizeWidgets(s.widgets.map(w=>parsed.has(w.widgetId)?{...w,layout:parsed.get(w.widgetId)!}:w))}));get().persist();
 },
 addRegistered(raw){
  if(get().disposed||get().running||!get().threadId||get().storageBlocked)return;
  const content=validateRegistered(raw);
  const existing=get().widgets.find(w=>isRegistered(w)&&w.sourceId===content.sourceId);
  if(existing){get().selectTab(existing.tabId||"main");get().select(existing.widgetId);return;}
  if(get().widgets.length>=50){set({notice:"패널은 최대 50개까지 추가할 수 있습니다."});return;}
  const widget=canvasWidgetSchema.parse({...structuredClone(content),kind:"registered",schemaVersion:1,catalogVersion:1,widgetId:crypto.randomUUID(),definitionRevision:1,tabId:get().activeTabId,layout:{w:12,h:14}});
  set(s=>({widgets:[...s.widgets,widget],selected:widget.widgetId}));get().persist();
 },
 removeSource(sourceId){if(get().running||get().storageBlocked||get().disposed)return;const w=get().widgets.find(w=>isRegistered(w)?w.sourceId===sourceId:w.sourceArtifactId===sourceId);if(w)get().remove(w.widgetId);},
 reorder(id,beforeId,tabId=get().activeTabId){
  if(get().running||get().storageBlocked||get().disposed||id===beforeId||!get().tabs.some(t=>t.id===tabId))return;
  const item=get().widgets.find(w=>w.widgetId===id);if(!item)return;
  const target=beforeId?get().widgets.find(w=>w.widgetId===beforeId):undefined;
  if(beforeId&&(!target||(target.tabId||"main")!==tabId))return;
  const widgets=get().widgets.filter(w=>w.widgetId!==id);
  const index=beforeId?widgets.findIndex(w=>w.widgetId===beforeId):widgets.length;
  widgets.splice(index,0,{...item,tabId});set({widgets:widgets.map(w=>(w.tabId||"main")===tabId?{...w,layout:{w:w.layout?.w??12,h:w.layout?.h??14}}:w),selected:id});get().persist();
 },
 addArtifact(raw){
  if(get().disposed||get().running||!get().threadId||get().storageBlocked)return;
  const artifact=artifactSchema.parse(raw);
  const existing=get().widgets.find(w=>!isRegistered(w)&&w.sourceArtifactId===artifact.artifactId);
  if(existing){get().selectTab(existing.tabId||"main");get().select(existing.widgetId);return;}
  if(get().widgets.length>=50){set({notice:"패널은 최대 50개까지 추가할 수 있습니다."});return;}
  const widget=widgetSchema.parse({...structuredClone(artifact),widgetId:crypto.randomUUID(),sourceArtifactId:artifact.artifactId,catalogVersion:1,program:`root = Col([CanvasChart(${JSON.stringify(artifact.title)}, ${JSON.stringify(artifact.chartType)})])`,definitionRevision:1,refreshPolicy:"manual",intervalSeconds:60,uiState:{},tabId:get().activeTabId,layout:{w:12,h:14}});
  validProgram(widget.program);set(s=>({widgets:[...s.widgets,widget],selected:widget.widgetId}));get().persist();
 },
 threadId,disposed:false,tabs:[{id:"main",title:"대시보드"}],activeTabId:"main",legacyAvailable:false,
 fallbacks:[],widgets:[],selected:null,pending:{},notice:"",hydrated:false,running:false,storageBlocked:false,refreshStatus:{},
 hydrate(){let raw="";try{
  raw=get().threadId?localStorage.getItem(threadCanvasKey(get().threadId!))||"":"";
  if(raw){const d=documentSchema.parse(JSON.parse(raw));if(d.threadId!==get().threadId)throw new Error("다른 채팅의 저장본입니다.");d.widgets.forEach(w=>isRegistered(w)?validateRegistered(w):validProgram(w.program));set({widgets:normalizeWidgets(d.widgets),tabs:d.tabs,activeTabId:d.activeTabId,selected:d.selectedWidgetId});}
  set({hydrated:true,legacyAvailable:!!localStorage.getItem(STORAGE_KEY)});
 }catch{set({widgets:[],fallbacks:fallbackSnapshots(raw),notice:"지원하지 않는 저장 형식 또는 UI입니다. 원본을 보존합니다.",hydrated:true,storageBlocked:true});}},
 persist(){if(get().disposed)return;if(get().storageBlocked){set({notice:"호환되지 않는 원본 저장본을 보존 중입니다. 새 데이터로 덮어쓰지 않았습니다."});return;}if(!get().threadId)return;set({widgets:normalizeWidgets(get().widgets)});try{localStorage.setItem(threadCanvasKey(get().threadId!),JSON.stringify({schemaVersion:5,threadId:get().threadId,tabs:get().tabs,activeTabId:get().activeTabId,selectedWidgetId:get().selected,widgets:get().widgets}));set({notice:"이 채팅의 Canvas를 브라우저에 저장했습니다."});}catch{set({notice:"저장 공간이 부족합니다. 화면의 데이터는 유지됩니다."});}},
 addTab(){if(get().tabs.length>=20)return;const id=crypto.randomUUID();set(s=>({tabs:[...s.tabs,{id,title:`탭 ${s.tabs.length+1}`}],activeTabId:id,selected:null}));get().persist();},
 renameTab(id,title){const name=title.trim().slice(0,80);if(!name)return;set(s=>({tabs:s.tabs.map(t=>t.id===id?{...t,title:name}:t)}));get().persist();},
 selectTab(id){if(!get().tabs.some(t=>t.id===id))return;set({activeTabId:id,selected:null});get().persist();},
 removeTab(id){if(get().running)return;const tabs=get().tabs.filter(t=>t.id!==id);if(!tabs.length)tabs.push({id:crypto.randomUUID(),title:"대시보드"});set(s=>({tabs,activeTabId:s.activeTabId===id?tabs[0].id:s.activeTabId,widgets:s.widgets.filter(w=>(w.tabId||"main")!==id),selected:null}));get().persist();},
 transfer(id,tabId){if(!get().tabs.some(t=>t.id===tabId))return;const w=get().widgets.find(w=>w.widgetId===id);if(!w)return;get().edit(id,{tabId,layout:{w:w.layout?.w??12,h:w.layout?.h??14}});set({selected:null});},
 importLegacy(){try{const widgets=restore(localStorage.getItem(STORAGE_KEY)||"{}");widgets.forEach(w=>validProgram(w.program));if(get().widgets.length+widgets.length>50)throw new Error("패널은 최대 50개까지 저장할 수 있습니다.");set(s=>({widgets:[...s.widgets,...widgets.map(w=>({...w,widgetId:crypto.randomUUID(),tabId:s.activeTabId}))],notice:"이전 Canvas를 가져왔습니다. 원본은 보존됩니다."}));get().persist();}catch(e){set({notice:String(e)});}},
 select(id){set({selected:id});get().persist();},
 event(e){
  if(get().disposed)return;
  if(retiredRuns.has(e.runId))return;
  const previous=sequences.get(e.runId)??-1;if(e.sequence<=previous)return;sequences.set(e.runId,e.sequence);
  if(e.channel!=="canvas")return;
  const id=e.widgetId;if(!id)return;
  const old=get().widgets.find(w=>w.widgetId===id);
  if(e.type==="start"){set(s=>({pending:{...s.pending,[id]:{tabId:e.tabId||old?.tabId||get().activeTabId,title:e.title||old?.title||"새 차트",program:"",message:"생성 중",runId:e.runId,action:e.action||"create"}}}));return;}
  if(e.type==="delta"||e.type==="progress"){set(s=>{const p=s.pending[id];return p&&p.runId===e.runId?{pending:{...s.pending,[id]:{...p,program:p.program+(e.delta||""),message:e.message||p.message,snapshot:e.snapshot?snapshotSchema.parse(e.snapshot):p.snapshot}}}:{};});return;}
  if(e.type==="error"){set(s=>({notice:e.error||"실패",pending:{...s.pending,[id]:{tabId:e.tabId||old?.tabId||get().activeTabId,title:old?.title||"차트",program:"",message:"실패",runId:e.runId,action:"error",error:e.error}}}));return;}
  if((old?.definitionRevision||0)!==(e.baseRevision||0)){set({notice:"더 최근 변경이 있어 이전 응답을 적용하지 않았습니다."});return;}
  if(e.type==="delete"){get().remove(id);return;}
  if(e.type==="commit"){
   try{const w=canvasWidgetSchema.parse(e.widget);if(w.widgetId!==id)throw new Error("위젯 ID가 일치하지 않습니다.");if(isRegistered(w))validateRegistered(w);else validProgram(w.program);if(!get().tabs.some(t=>t.id===(w.tabId||"main")))throw new Error("대상 탭이 삭제되었습니다.");set(s=>({widgets:old?s.widgets.map(item=>item.widgetId===id?w:item):[...s.widgets,w],pending:Object.fromEntries(Object.entries(s.pending).filter(([key])=>key!==id))}));get().persist();}
   catch(err){set({notice:String(err)});}
  }
 },
 finish(runId){if(runId){retiredRuns.add(runId);sequences.delete(runId);if(retiredRuns.size>200)retiredRuns.delete(retiredRuns.values().next().value!);}set(s=>({running:false,pending:Object.fromEntries(Object.entries(s.pending).map(([id,p])=>[id,(!runId||p.runId===runId)&&!p.error?{...p,error:"완료되지 않은 작업입니다. 다시 요청해주세요.",message:"중단됨"}:p]))}));},
 async refresh(id){
  const w=get().widgets.find(x=>x.widgetId===id);if(get().disposed||!w||isRegistered(w)||requests.has(id))return;
  if(w.refreshPolicy==="snapshot"){set({notice:"Snapshot 모드입니다. 수동 갱신으로 바꾸면 새로 조회합니다."});return;}
  const requestId=crypto.randomUUID();requests.set(id,requestId);
  set(s=>({pending:{...s.pending,[id]:{title:w.title,program:"",message:"데이터 갱신 중",runId:requestId,action:"refresh"}}}));
  try{
   const response=await fetch(`/api/workspace/query/${w.queryId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({parameters:w.parameters,queryVersion:w.queryVersion}),signal:AbortSignal.timeout(10000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||"조회 실패");
   const snapshot=snapshotSchema.parse(data);
   if(get().disposed)return;
   const latest=get().widgets.find(x=>x.widgetId===id);
   if(latest?.definitionRevision===w.definitionRevision && requests.get(id)===requestId){set(s=>({widgets:s.widgets.map(x=>x.widgetId===id?{...x,snapshot}:x),refreshStatus:{...s.refreshStatus,[id]:{failures:0,nextAttemptAt:0,error:""}}}));get().persist();}
  }catch(e){const failures=(get().refreshStatus[id]?.failures||0)+1;const error=`갱신 실패: ${String(e)}. 마지막 정상 데이터를 표시합니다.`;set(s=>({notice:error,refreshStatus:{...s.refreshStatus,[id]:{failures,nextAttemptAt:Date.now()+Math.min(300000,w.intervalSeconds*1000*2**failures),error}}}));}
  finally{requests.delete(id);set(s=>({pending:Object.fromEntries(Object.entries(s.pending).filter(([key,p])=>key!==id||p.runId!==requestId))}));const latest=get().widgets.find(x=>x.widgetId===id);if(!get().disposed&&latest&&latest.definitionRevision!==w.definitionRevision&&!isRegistered(latest)&&latest.refreshPolicy!=="snapshot")void get().refresh(id);}
 },
 edit(id,patch){if(patch.layout)patch={...patch,layout:clampGrid(patch.layout)};const current=get().widgets.find(w=>w.widgetId===id);if(!current||Object.entries(patch).every(([key,value])=>JSON.stringify((current as Record<string,unknown>)[key])===JSON.stringify(value)))return;set(s=>({widgets:s.widgets.map(w=>w.widgetId===id?canvasWidgetSchema.parse({...w,...patch,definitionRevision:patch.uiState||patch.layout||patch.tabId?w.definitionRevision:w.definitionRevision+1}):w)}));get().persist();},
 remove(id){requests.delete(id);set(s=>({widgets:s.widgets.filter(w=>w.widgetId!==id),pending:Object.fromEntries(Object.entries(s.pending).filter(([key])=>key!==id)),selected:s.selected===id?null:s.selected}));get().persist();},
 move(id){const item=get().widgets.find(w=>w.widgetId===id);if(!item)return;const first=get().widgets.find(w=>w.widgetId!==id&&(w.tabId||"main")===(item.tabId||"main"));get().reorder(id,first?.widgetId,item.tabId||"main");},
}));

}
type CanvasStore=ReturnType<typeof createCanvasStore>;
const stores=new Map<string,CanvasStore>();
const scope=create<{threadId:string|null;generation:number}>(()=>({threadId:null,generation:0}));
export function getCanvasStore(id:string|null){const key=id??"__draft__";let store=stores.get(key);if(!store){store=createCanvasStore(id);stores.set(key,store);}return store;}
export function activateThread(id:string|null){if(id)hydrateArtifacts(id);const store=getCanvasStore(id);if(!store.getState().hydrated)store.getState().hydrate();scope.setState({threadId:id});try{if(id)localStorage.setItem(ACTIVE_THREAD_KEY,id);else localStorage.removeItem(ACTIVE_THREAD_KEY);}catch{}}
export function beginNewCanvas(){const draft=stores.get("__draft__");draft?.setState({disposed:true});stores.delete("__draft__");activateThread(null);scope.setState(s=>({generation:s.generation+1}));}
export function adoptDraft(id:string){const draft=getCanvasStore(null);draft.setState({threadId:id});stores.set(id,draft);stores.delete("__draft__");activateThread(id);draft.getState().persist();}
export function discardThread(id:string){removeArtifacts(id);stores.get(id)?.setState({disposed:true});stores.delete(id);try{localStorage.removeItem(threadCanvasKey(id));}catch{}if(scope.getState().threadId===id)activateThread(null);}
function useScopedCanvas<T>(selector:(state:State)=>T):T{const current=scope();return getCanvasStore(current.threadId)(selector);}
export const useCanvas=Object.assign(useScopedCanvas,{
 getState:()=>getCanvasStore(scope.getState().threadId).getState(),
 setState:(...args:Parameters<CanvasStore["setState"]>)=>getCanvasStore(scope.getState().threadId).setState(...args),
});
