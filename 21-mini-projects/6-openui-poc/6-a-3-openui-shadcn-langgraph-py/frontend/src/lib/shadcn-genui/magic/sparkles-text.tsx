"use client";
import { SparklesText as Upstream } from "@/components/magicui/sparkles-text";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "sparklesCount">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
