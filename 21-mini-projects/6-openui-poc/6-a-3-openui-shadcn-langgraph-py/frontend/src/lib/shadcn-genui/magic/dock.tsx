"use client";
import { Dock as Upstream } from "@/components/magicui/dock";
import { DockIcon } from "@/components/magicui/dock";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "iconSize" | "iconMagnification" | "disableMagnification" | "iconDistance" | "direction">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream {...settings}>{items.map((item,i)=><DockIcon key={i}><span title={item}>{item.slice(0,2)}</span></DockIcon>)}</Upstream>;}
