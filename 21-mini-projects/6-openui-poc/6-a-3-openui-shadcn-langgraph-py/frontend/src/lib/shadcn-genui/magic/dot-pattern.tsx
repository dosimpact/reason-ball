"use client";
import { DotPattern as Upstream } from "@/components/magicui/dot-pattern";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "x" | "y" | "cx" | "cy" | "cr" | "glow">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
