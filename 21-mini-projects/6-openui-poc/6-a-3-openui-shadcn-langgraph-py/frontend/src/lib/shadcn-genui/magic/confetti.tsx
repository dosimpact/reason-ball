"use client";
import { Confetti as Upstream } from "@/components/magicui/confetti";
import { useRef } from "react";
import type { ConfettiRef } from "@/components/magicui/confetti";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "manualstart">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {const confetti=useRef<ConfettiRef>(null);return <div className="relative h-48"><Upstream {...settings} ref={confetti} manualstart={true} className="absolute inset-0 size-full" globalOptions={{resize:true,useWorker:false}} /><button className="relative rounded border p-3" onClick={()=>confetti.current?.fire({particleCount:70,spread:60})}>{text}</button></div>;}
