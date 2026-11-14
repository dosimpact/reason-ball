"use client";
import { TextAnimate as Upstream } from "@/components/magicui/text-animate";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "segmentClassName" | "startOnView" | "once" | "accessible" | "duration" | "delay">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
