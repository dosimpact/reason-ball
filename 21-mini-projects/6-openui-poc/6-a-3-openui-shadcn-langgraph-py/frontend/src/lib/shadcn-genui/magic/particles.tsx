"use client";
import { Particles as Upstream } from "@/components/magicui/particles";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "quantity" | "staticity" | "ease" | "size" | "refresh" | "color" | "vx" | "vy">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
