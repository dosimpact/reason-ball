"use client";
import { ShinyButton as Upstream } from "@/components/magicui/shiny-button";
import { BuiltinActionType, useTriggerAction, useFormName, useIsStreaming } from "@openuidev/react-lang";
import type { MagicProps } from "./types";
export default function Example({action,text="Magic UI",}:MagicProps) {const trigger=useTriggerAction(); const form=useFormName(); const streaming=useIsStreaming();return <Upstream aria-disabled={streaming} onClick={()=>{if(action && !streaming) trigger(text,form,{type:action.type,params:action.type===BuiltinActionType.OpenUrl ? {url:(action as {url:string}).url} : (action as {params?:Record<string,unknown>}).params});}} >{text}</Upstream>;}
