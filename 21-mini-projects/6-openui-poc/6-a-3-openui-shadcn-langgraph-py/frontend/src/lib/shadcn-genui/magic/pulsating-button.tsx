"use client";
import { PulsatingButton as Upstream } from "@/components/magicui/pulsating-button";
import { BuiltinActionType, useTriggerAction, useFormName, useIsStreaming } from "@openuidev/react-lang";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "pulseColor" | "distance" | "variant">>;
export default function Example({action,text="Magic UI",...settings}:MagicProps & Settings) {const trigger=useTriggerAction(); const form=useFormName(); const streaming=useIsStreaming();return <Upstream disabled={streaming} onClick={()=>{if(action) trigger(text,form,{type:action.type,params:action.type===BuiltinActionType.OpenUrl ? {url:(action as {url:string}).url} : (action as {params?:Record<string,unknown>}).params});}} {...settings} >{text}</Upstream>;}
