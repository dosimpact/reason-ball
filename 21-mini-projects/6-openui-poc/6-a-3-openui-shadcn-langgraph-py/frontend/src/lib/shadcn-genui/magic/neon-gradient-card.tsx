"use client";
import { NeonGradientCard as Upstream } from "@/components/magicui/neon-gradient-card";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "borderSize" | "borderRadius">>;
export default function Example({text="Magic UI",firstColor="#ff00aa",secondColor="#00fff1",...settings}:MagicProps & Settings & {firstColor?:string;secondColor?:string}) {return <Upstream {...settings} neonColors={{firstColor,secondColor}}>{text}</Upstream>;}
