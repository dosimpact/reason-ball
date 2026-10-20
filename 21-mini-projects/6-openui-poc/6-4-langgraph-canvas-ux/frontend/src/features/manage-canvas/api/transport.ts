import { saveArtifact,useArtifacts } from "@/entities/analysis";
import { getCanvasStore } from "../model/store";
import type { CanvasEvent } from "@/entities/analysis";

/** Keep AgentInterface's AG-UI contract, routing only Canvas events to the dashboard. */
export const workspaceFetch:typeof fetch=async(_input,init)=>{
 const body=JSON.parse(String(init?.body||"{}"));
 const messages=body.messages||[];
 const last=messages.at(-1);
 const message=typeof last?.content==="string"?last.content:JSON.stringify(last?.content||"");
 const owner=getCanvasStore(body.threadId||null);
 const state=owner.getState();owner.setState({running:true});
 let response:Response;
 try{response=await fetch("/api/workspace/run",{...init,body:JSON.stringify({message,threadId:state.threadId,chatArtifacts:Object.values(useArtifacts.getState().threads[state.threadId||""]||{}).slice(-50),canvas:{tabs:state.tabs,activeTabId:state.activeTabId,pending:state.pending,refreshStatus:state.refreshStatus},history:messages.slice(-13,-1).filter((m:{role:string})=>["user","assistant"].includes(m.role)).map((m:{role:string;content:unknown})=>({role:m.role,content:typeof m.content==="string"?m.content:JSON.stringify(m.content)})),widgets:state.widgets,selectedWidgetId:state.selected})});}
 catch(e){owner.getState().finish();throw e;}
 if(!response.ok||!response.body){owner.getState().finish();return response;}
 const messageId=crypto.randomUUID();let started=false;let done=false;let runId="";
 const encoder=new TextEncoder();const reader=response.body.getReader();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   const emit=(e:unknown)=>controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
   emit({type:"RUN_STARTED",threadId:body.threadId||"workspace",runId:body.runId||messageId});
   let buffer="";const decoder=new TextDecoder();
   try{
    while(true){const next=await reader.read();buffer+=decoder.decode(next.value,{stream:!next.done});
     let boundary:number;
     while((boundary=buffer.indexOf("\n\n"))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
      const line=frame.split("\n").find(l=>l.startsWith("data: "));if(!line)continue;
      const e=JSON.parse(line.slice(6)) as CanvasEvent & {artifact?:unknown};runId=e.runId;
      if(e.channel==="artifact"&&e.type==="commit"&&state.threadId&&!owner.getState().disposed){
       try{saveArtifact(state.threadId,e.artifact);}catch(error){console.error("Analysis artifact rejected",error);owner.setState({notice:"분석 차트 저장에 실패했습니다. 브라우저 저장 공간 또는 데이터 형식을 확인해주세요."});}
      }
      owner.getState().event(e);
      if(e.channel==="chat"&&e.delta){if(!started){emit({type:"TEXT_MESSAGE_START",messageId,role:"assistant"});started=true;}emit({type:"TEXT_MESSAGE_CONTENT",messageId,delta:e.delta});}
      if(e.channel==="run"&&e.type==="error")throw new Error(e.error||"실행 실패");
      if(e.channel==="run"&&e.type==="done")done=true;
     }
     if(next.done)break;
    }
    if(!done)throw new Error("스트림이 완료 전에 종료되었습니다.");
    if(started)emit({type:"TEXT_MESSAGE_END",messageId});
    emit({type:"RUN_FINISHED",threadId:body.threadId||"workspace",runId:body.runId||messageId});controller.close();
   }catch(e){owner.setState({notice:String(e)});controller.error(e);}
   finally{await reader.cancel().catch(()=>{});owner.getState().finish(runId);}
  },
  cancel(){owner.getState().finish(runId);return reader.cancel();},
 });
 return new Response(stream,{headers:{"Content-Type":"text/event-stream"}});
};
