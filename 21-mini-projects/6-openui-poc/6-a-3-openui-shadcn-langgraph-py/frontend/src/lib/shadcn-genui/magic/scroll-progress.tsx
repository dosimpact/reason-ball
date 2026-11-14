"use client";
import { ScrollProgress } from "@/components/magicui/scroll-progress";
import { useRef } from "react";
import type { MagicProps } from "./types";
export default function Example({text="Scroll to see your progress",items=["Introduction","Design","Implementation","Validation"]}:MagicProps){const root=useRef<HTMLDivElement>(null);return <div ref={root} className="h-48 overflow-y-auto"><ScrollProgress containerRef={root}/><p>{text}</p>{items.map((item,i)=><section className="py-16" key={i}>{item}</section>)}</div>;}
