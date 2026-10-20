"use client";
import type {ReactNode} from "react";
import {AnalysisHostContext,CanvasHostContext,isRegistered} from "@/entities/analysis";
import {useCanvas} from "@/features/manage-canvas";
export function AnalysisHost({children}:{children:ReactNode}){
 const threadId=useCanvas(s=>s.threadId);const running=useCanvas(s=>s.running);const blocked=useCanvas(s=>s.storageBlocked);const widgets=useCanvas(s=>s.widgets);const add=useCanvas(s=>s.addArtifact);const addRegistered=useCanvas(s=>s.addRegistered);const remove=useCanvas(s=>s.removeSource);
 return <CanvasHostContext.Provider value={{threadId,disabled:running||blocked||!threadId,add:addRegistered,remove,added:widgets.flatMap(w=>isRegistered(w)?[w.sourceId]:[])}}><AnalysisHostContext.Provider value={{threadId,running:running||blocked,add,remove,added:widgets.flatMap(w=>!isRegistered(w)&&w.sourceArtifactId?[w.sourceArtifactId]:[])}}>{children}</AnalysisHostContext.Provider></CanvasHostContext.Provider>;
}
