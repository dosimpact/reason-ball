"use client";
import { AnimatedCircularProgressBar as Upstream } from "@/components/magicui/animated-circular-progress-bar";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "max" | "min" | "gaugePrimaryColor" | "gaugeSecondaryColor">>;
export default function Example({value=75,...settings}:MagicProps & Settings) {return <Upstream {...settings} value={value} gaugePrimaryColor={settings.gaugePrimaryColor ?? "#6366f1"} gaugeSecondaryColor={settings.gaugeSecondaryColor ?? "#e5e7eb"} />;}
