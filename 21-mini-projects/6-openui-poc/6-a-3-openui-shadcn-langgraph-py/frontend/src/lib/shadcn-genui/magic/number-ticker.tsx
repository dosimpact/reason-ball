"use client";
import { NumberTicker as Upstream } from "@/components/magicui/number-ticker";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "startValue" | "direction" | "decimalPlaces" | "delay">>;
export default function Example({value=75,...settings}:MagicProps & Settings) {return <Upstream {...settings} value={value} />;}
