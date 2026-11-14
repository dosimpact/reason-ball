"use client";
import { GlareHover as Upstream } from "@/components/magicui/glare-hover";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "background" | "opacity" | "angle" | "size" | "playOnce" | "duration">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
