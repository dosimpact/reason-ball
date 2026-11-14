"use client";
import { BorderBeam as Upstream } from "@/components/magicui/border-beam";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "size" | "colorFrom" | "colorTo" | "reverse" | "initialOffset" | "borderWidth" | "duration" | "delay">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
