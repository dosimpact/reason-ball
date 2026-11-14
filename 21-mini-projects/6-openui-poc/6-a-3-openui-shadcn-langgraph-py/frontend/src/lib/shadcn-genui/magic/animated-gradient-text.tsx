"use client";
import { AnimatedGradientText as Upstream } from "@/components/magicui/animated-gradient-text";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "speed" | "colorFrom" | "colorTo">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
