"use client";
import { Ripple as Upstream } from "@/components/magicui/ripple";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "mainCircleSize" | "mainCircleOpacity" | "numCircles">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
