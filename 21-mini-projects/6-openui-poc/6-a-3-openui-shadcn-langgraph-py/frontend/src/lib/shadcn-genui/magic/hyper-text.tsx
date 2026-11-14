"use client";
import { HyperText as Upstream } from "@/components/magicui/hyper-text";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "startOnView" | "animateOnHover" | "duration" | "delay">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
