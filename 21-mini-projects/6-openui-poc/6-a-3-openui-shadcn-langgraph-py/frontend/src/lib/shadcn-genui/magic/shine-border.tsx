"use client";
import { ShineBorder as Upstream } from "@/components/magicui/shine-border";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "borderWidth" | "duration">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
