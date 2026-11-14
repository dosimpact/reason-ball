"use client";
import { Marquee as Upstream } from "@/components/magicui/marquee";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "reverse" | "pauseOnHover" | "vertical">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream {...settings}>{items.map((item,i)=><div className="rounded-lg border p-3" key={i}>{item}</div>)}</Upstream>;}
