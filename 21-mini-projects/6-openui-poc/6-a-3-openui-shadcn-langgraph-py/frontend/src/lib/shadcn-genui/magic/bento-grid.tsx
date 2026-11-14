"use client";
import { BentoGrid as Upstream } from "@/components/magicui/bento-grid";
import { BentoCard } from "@/components/magicui/bento-grid";
import { Sparkles } from "lucide-react";
import type { MagicProps } from "./types";
export default function Example({cards,text="Magic UI",items=["Design","Build","Ship"],}:MagicProps) {return <Upstream>{(cards ?? items.map(title=>({title,description:text,href:"https://magicui.design",cta:"Learn more"}))).map((item,i)=><BentoCard key={i} name={item.title} description={item.description} className="col-span-3" background={<div />} Icon={Sparkles} href={item.href} cta={item.cta} />)}</Upstream>;}
