"use client";
import { Globe, GLOBE_CONFIG } from "@/components/magicui/globe";
import { useMemo } from "react";
type GlobeProps={markers?:{latitude:number;longitude:number;size?:number}[];dark?:boolean;theta?:number;mapBrightness?:number};
export default function GlobeExample({markers,dark=false,theta=0.3,mapBrightness=1.2}:GlobeProps){const config=useMemo(()=>({...GLOBE_CONFIG,dark:dark?1:0,theta,mapBrightness,markers:markers?.map(marker=>({location:[marker.latitude,marker.longitude] as [number,number],size:marker.size ?? 0.05})) ?? GLOBE_CONFIG.markers}),[markers,dark,theta,mapBrightness]);return <Globe config={config}/>;}
