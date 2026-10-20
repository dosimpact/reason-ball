"use client";
import {writeCanvasDrag} from "./registration";
import {useContext} from "react";
import {defineComponent} from "@openuidev/react-lang";
import {z} from "zod";
import {AnalysisHostContext,useArtifacts} from "../model/artifacts";
export const AnalysisChart=defineComponent({
 name:"AnalysisChart",props:z.object({artifactId:z.string()}),
 description:"A published DuckDB analysis chart with an Add to Canvas button. Use ONLY artifactId returned by publish_analysis_chart.",
 component:function AnalysisChartView({props,renderNode}){
  const host=useContext(AnalysisHostContext);
  const artifact=useArtifacts(s=>host.threadId?s.threads[host.threadId]?.[props.artifactId]:undefined);
  if(!artifact)return <p role="status">분석 차트 정보를 불러올 수 없습니다. 분석을 다시 요청해주세요.</p>;
  const added=host.added.includes(artifact.artifactId);
  return <section data-testid="analysis-chart"><h3>{artifact.title}</h3>
   {renderNode({type:"element",typeName:"Chart",props:{type:artifact.chartType,data:artifact.snapshot.rows,x:"period",series:["value"],format:"number"},partial:false})}
   <p>합성 데이터 · 조회 시각 {artifact.snapshot.fetchedAt}</p>
   <button type="button" disabled={host.running||!host.threadId} onClick={()=>host.add(artifact)}>{added?"Canvas에서 보기":"Add to Canvas"}</button>
   {added&&<button type="button" disabled={host.running} onClick={()=>host.remove(artifact.artifactId)}>Delete from Canvas</button>}
   <button type="button" aria-label={`${artifact.title} Canvas로 드래그`} draggable={!host.running&&!!host.threadId} disabled={host.running||!host.threadId} onDragStart={e=>{if(!host.threadId||host.running){e.preventDefault();return;}writeCanvasDrag(e,{version:1,threadId:host.threadId,type:"analysis",artifactId:artifact.artifactId});}}>⠿ Canvas로 드래그</button>
   <details><summary>조회 정의</summary><p>{artifact.queryDefinition.title}</p><p>{artifact.queryDefinition.description}</p><pre>{artifact.queryDefinition.sql}</pre></details>
  </section>;
 }
});
