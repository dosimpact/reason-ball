"use client";
import { BlurFade as Upstream } from "@/components/magicui/blur-fade";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "offset" | "direction" | "inView" | "blur" | "duration" | "delay">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
