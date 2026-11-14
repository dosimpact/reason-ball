"use client";
import { ProgressiveBlur as Upstream } from "@/components/magicui/progressive-blur";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "position">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
