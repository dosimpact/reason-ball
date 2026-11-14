"use client";
import { Tree as Upstream } from "@/components/magicui/file-tree";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "indicator">>;
export default function Example({items=["Design","Build","Ship"],direction,...settings}:MagicProps & Settings & {direction?:"rtl"|"ltr"}) {return <Upstream {...settings} dir={direction} elements={items.map((name,i)=>({id:String(i),name,type:"file" as const}))} />;}
