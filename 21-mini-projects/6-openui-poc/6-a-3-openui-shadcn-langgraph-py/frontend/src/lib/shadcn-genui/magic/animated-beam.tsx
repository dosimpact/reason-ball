"use client";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { createRef, useMemo, useRef, type ComponentProps } from "react";
import type { MagicProps } from "./types";
type Settings=Partial<Pick<ComponentProps<typeof AnimatedBeam>,"curvature"|"reverse"|"pathColor"|"pathWidth"|"pathOpacity"|"gradientStartColor"|"gradientStopColor"|"duration"|"delay"|"repeatDelay"|"startXOffset"|"startYOffset"|"endXOffset"|"endYOffset">>;
export default function BeamExample({nodes,edges,items=["Agent","Tool"],...settings}:MagicProps & Settings){
 const labels=nodes ?? items; const container=useRef<HTMLDivElement>(null);
 const refs=useMemo(()=>labels.map(()=>createRef<HTMLDivElement>()),[labels]);
 return <div ref={container} className="relative flex min-h-48 items-center justify-around gap-8 p-5">{labels.map((label,i)=><div ref={refs[i]} className="z-10 rounded border bg-background p-3" key={i}>{label}</div>)}{(edges ?? [{from:0,to:1}]).filter(edge=>refs[edge.from] && refs[edge.to]).map((edge,i)=><AnimatedBeam key={i} {...settings} containerRef={container} fromRef={refs[edge.from]} toRef={refs[edge.to]}/>)}</div>;
}
