"use client";
import { LightRays as Upstream } from "@/components/magicui/light-rays";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "count" | "color" | "blur" | "speed" | "length">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
