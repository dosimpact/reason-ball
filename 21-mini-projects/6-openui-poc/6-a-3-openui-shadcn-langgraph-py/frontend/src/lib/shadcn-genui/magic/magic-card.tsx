"use client";
import { MagicCard as Upstream } from "@/components/magicui/magic-card";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "gradientSize" | "gradientFrom" | "gradientTo">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
