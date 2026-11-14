"use client";
import { Meteors as Upstream } from "@/components/magicui/meteors";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "number" | "minDelay" | "maxDelay" | "minDuration" | "maxDuration" | "angle">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
