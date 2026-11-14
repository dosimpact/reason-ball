"use client";
import { AnimatedGridPattern as Upstream } from "@/components/magicui/animated-grid-pattern";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "x" | "y" | "strokeDasharray" | "numSquares" | "maxOpacity" | "repeatDelay" | "duration">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
