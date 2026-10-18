"use client";
import {createContext} from "react";
import {create} from "zustand";
import {z} from "zod";
import {artifactSchema,type ChartArtifact} from "./model";
const key=(threadId:string)=>`canvas-ux:artifacts:${encodeURIComponent(threadId)}`;
const savedSchema=z.object({schemaVersion:z.literal(1),artifacts:z.record(z.string(),artifactSchema)});
export const useArtifacts=create<{threads:Record<string,Record<string,ChartArtifact>>}>(()=>({threads:{}}));
const blocked=new Set<string>();
export function hydrateArtifacts(threadId:string){
 if(useArtifacts.getState().threads[threadId])return;
 let artifacts:Record<string,ChartArtifact>={};
 try{const raw=localStorage.getItem(key(threadId));if(raw)artifacts=savedSchema.parse(JSON.parse(raw)).artifacts;}catch{blocked.add(threadId);}
 useArtifacts.setState(s=>({threads:{...s.threads,[threadId]:artifacts}}));
}
export function saveArtifact(threadId:string,raw:unknown){
 hydrateArtifacts(threadId);const artifact=artifactSchema.parse(raw);
 useArtifacts.setState(s=>({threads:{...s.threads,[threadId]:{...s.threads[threadId],[artifact.artifactId]:artifact}}}));
 if(!blocked.has(threadId))localStorage.setItem(key(threadId),JSON.stringify({schemaVersion:1,artifacts:useArtifacts.getState().threads[threadId]}));
}
export function removeArtifacts(threadId:string){blocked.delete(threadId);useArtifacts.setState(s=>({threads:Object.fromEntries(Object.entries(s.threads).filter(([id])=>id!==threadId))}));try{localStorage.removeItem(key(threadId));}catch{}}
export const AnalysisHostContext=createContext<{threadId:string|null;running:boolean;add:(artifact:ChartArtifact)=>void;remove:(sourceId:string)=>void;added:string[]}>({threadId:null,running:false,add:()=>{},remove:()=>{},added:[]});
