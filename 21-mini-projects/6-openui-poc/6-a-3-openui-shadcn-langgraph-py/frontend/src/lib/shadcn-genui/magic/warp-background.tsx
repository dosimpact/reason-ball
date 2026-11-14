"use client";
import { WarpBackground as Upstream } from "@/components/magicui/warp-background";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "perspective" | "beamsPerSide" | "beamSize" | "beamDelayMax" | "beamDelayMin" | "beamDuration" | "gridColor">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
