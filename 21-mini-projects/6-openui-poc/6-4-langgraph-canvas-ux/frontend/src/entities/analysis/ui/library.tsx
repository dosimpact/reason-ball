"use client";
import { createContext, useContext } from "react";
import { createLibrary, createParser, defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import {CanvasItem} from "./registration";
import { AnalysisChart } from "./analysis-chart";
import { library } from "@/shared/ui/openui";
import type { Snapshot } from "../model/model";
export const SnapshotContext=createContext<Snapshot|null>(null);
const CanvasChart=defineComponent({
  name:"CanvasChart",props:z.object({title:z.string(),chartType:z.enum(["bar","line","area","pie","donut","scatter"])}),
  description:"An independently refreshed synthetic analytics chart owned by its Canvas widget.",
  component:function CanvasChartView({props,renderNode}) {
    const snapshot=useContext(SnapshotContext);
    if(!snapshot) return <p>데이터를 준비하고 있습니다.</p>;
    return <div><h3>{props.title}</h3>{snapshot.rows.length ? renderNode({type:"element",typeName:"Chart",props:{type:props.chartType,data:snapshot.rows,x:"period",series:["value"],format:"number"},partial:false}) : <p>조회 조건에 맞는 데이터가 없습니다.</p>}</div>;
  },
});
export const canvasLibrary=createLibrary({root:"Col",components:[...Object.values(library.components),CanvasChart],functions:Object.values(library.functions||{}),actions:Object.values(library.actions||{})});
const parser=createParser(canvasLibrary.toJSONSchema(),canvasLibrary.root);
export function validProgram(program:string) {
  const result=parser.parse(program);
  if(!result.root || result.meta.incomplete || result.meta.unresolved.length || result.meta.errors.some(e=>e.severity!=="warning")) throw new Error("OpenUI 프로그램 검증 실패: 기존 차트를 유지합니다.");
  return program;
}

export const chatLibrary=createLibrary({root:"Col",components:[...Object.values(library.components),AnalysisChart,CanvasItem],functions:Object.values(library.functions||{}),actions:Object.values(library.actions||{})});
