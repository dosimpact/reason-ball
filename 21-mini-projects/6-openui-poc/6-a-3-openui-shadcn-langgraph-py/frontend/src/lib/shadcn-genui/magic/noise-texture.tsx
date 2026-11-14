"use client";
import { NoiseTexture as Upstream } from "@/components/magicui/noise-texture";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "frequency" | "octaves" | "slope" | "noiseOpacity">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
