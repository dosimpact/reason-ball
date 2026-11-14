"use client";
import { RetroGrid as Upstream } from "@/components/magicui/retro-grid";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "angle" | "cellSize" | "opacity" | "lightLineColor" | "darkLineColor">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
