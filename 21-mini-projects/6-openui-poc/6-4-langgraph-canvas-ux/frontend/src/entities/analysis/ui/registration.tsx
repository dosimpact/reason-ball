"use client";
import {createContext,useContext,useState,type ReactNode,type DragEvent} from "react";
import {createParser,defineComponent,Renderer,type Library} from "@openuidev/react-lang";
import {z} from "zod";
import {library,runLibraryAction} from "@/shared/ui/openui";
import {registeredContentSchema,type RegisteredContent} from "../model/model";

// Registration is developer-controlled. Payloads contain IDs, never executable registry definitions.
export type CanvasRegistration={id:string;version:1;library:Library};
const registry=new Map<string,CanvasRegistration>();
export function registerCanvasElement(entry:CanvasRegistration){
 if(registry.has(entry.id))throw new Error(`Duplicate Canvas registration: ${entry.id}`);
 registry.set(entry.id,entry);return entry;
}
registerCanvasElement({id:"openui",version:1,library});
export function getCanvasRegistration(id:string){const entry=registry.get(id);if(!entry)throw new Error(`Unknown Canvas registration: ${id}`);return entry;}
export function validateRegistered(raw:unknown):RegisteredContent{
 const content=registeredContentSchema.parse(raw);const entry=getCanvasRegistration(content.registrationId);
 if(entry.version!==content.registrationVersion)throw new Error("Unsupported Canvas registration version");
 const result=createParser(entry.library.toJSONSchema(),entry.library.root).parse(content.program);
 if(!result.root||result.meta.incomplete||result.meta.unresolved.length||result.meta.errors.some(e=>e.severity!=="warning"))throw new Error("완성된 독립 OpenUI 프로그램이 필요합니다.");
 return content;
}
export const CANVAS_MIME="application/x-openui-canvas";
export type CanvasDrag={version:1;threadId:string;type:"registered";content:RegisteredContent}|{version:1;threadId:string;type:"widget";widgetId:string}|{version:1;threadId:string;type:"analysis";artifactId:string};
export function writeCanvasDrag(event:DragEvent,payload:CanvasDrag){event.dataTransfer.setData(CANVAS_MIME,JSON.stringify(payload));event.dataTransfer.effectAllowed=payload.type==="widget"?"move":"copy";}
export const CanvasHostContext=createContext<{threadId:string|null;disabled:boolean;added:string[];add:(content:RegisteredContent)=>void;remove:(sourceId:string)=>void}>({threadId:null,disabled:true,added:[],add:()=>{},remove:()=>{}});
export function CanvasRegistrationWrapper({content,children}:{content:RegisteredContent;children:ReactNode}){
 const host=useContext(CanvasHostContext);const added=host.added.includes(content.sourceId);
 return <section className="canvas-registration" data-testid="canvas-registration">
  {children}
  <div className="canvas-registration-actions">
   <button type="button" disabled={host.disabled} onClick={()=>host.add(content)}>{added?"Canvas에서 보기":"Add to Canvas"}</button>
   {added&&<button type="button" disabled={host.disabled} onClick={()=>host.remove(content.sourceId)}>Delete from Canvas</button>}
   <button type="button" aria-label={`${content.title} Canvas로 드래그`} draggable={!host.disabled} disabled={host.disabled} onDragStart={event=>{if(host.disabled||!host.threadId){event.preventDefault();return;}writeCanvasDrag(event,{version:1,threadId:host.threadId,type:"registered",content});}}>⠿ Canvas로 드래그</button>
  </div>
 </section>;
}
export function RegisteredRenderer({content,onStateUpdate}:{content:RegisteredContent;onStateUpdate?:(state:Record<string,unknown>)=>void}){
 const [notice,setNotice]=useState("");
 return <><Renderer library={getCanvasRegistration(content.registrationId).library} response={content.program} isStreaming={false} initialState={content.uiState} onStateUpdate={onStateUpdate} onAction={event=>{
  const handled=runLibraryAction(event);
  if(handled===null)setNotice("이 동작에는 별도의 호스트 액션 연결이 필요합니다.");
  else void handled.then(ok=>{if(!ok)setNotice("동작을 완료하지 못했습니다.");});
 }}/>{notice&&<p role="status">{notice}</p>}</>;
}
function CanvasItemView({id,title,program}:{id:string;title:string;program:string}){
 const [uiState,setUIState]=useState<Record<string,unknown>>({});
 let content:RegisteredContent;
 try{content=validateRegistered({registrationId:id,registrationVersion:1,title,program,sourceId:`${id}:${title}:${program}`,uiState});}
 catch{return <p role="status">Canvas 콘텐츠 준비 중이거나 등록 형식이 올바르지 않습니다.</p>;}
 return <CanvasRegistrationWrapper content={content}><RegisteredRenderer content={content} onStateUpdate={setUIState}/></CanvasRegistrationWrapper>;
}
export const CanvasItem=defineComponent({name:"CanvasItem",description:'Canvas registrable content. Use CanvasItem("openui", title, program). program is a JSON-escaped STRING containing a complete independent OpenUI program with root = Col([...]). All base library elements and compositions are supported. Never nest CanvasItem or AnalysisChart inside program. No outer variables. The wrapper provides Add/Delete and drag automatically. Use for non-analytics cards, text, tables, images and forms users may save.',props:z.object({registrationId:z.string(),title:z.string(),program:z.string()}),component:({props})=><CanvasItemView id={props.registrationId} title={props.title} program={props.program}/>});
