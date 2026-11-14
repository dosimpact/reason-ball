"use client";
import { OrbitingCircles as Upstream } from "@/components/magicui/orbiting-circles";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "reverse" | "radius" | "path" | "iconSize" | "speed" | "duration" | "delay">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream radius={75} {...settings}>{items.map((item,i)=><span className="rounded-full bg-indigo-100 p-2 text-indigo-900" key={i}>{item}</span>)}</Upstream>;}
