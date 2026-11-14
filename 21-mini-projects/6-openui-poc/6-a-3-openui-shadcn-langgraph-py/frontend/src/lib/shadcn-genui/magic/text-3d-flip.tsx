"use client";
import Upstream from "@/components/magicui/text-3d-flip";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "textClassName" | "flipTextClassName" | "staggerDuration" | "rotateDirection">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
