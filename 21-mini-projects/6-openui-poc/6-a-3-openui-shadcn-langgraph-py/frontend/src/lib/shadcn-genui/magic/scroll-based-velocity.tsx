"use client";
import { ScrollVelocityRow as Upstream } from "@/components/magicui/scroll-based-velocity";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "baseVelocity" | "scrollReactivity">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
