"use client";
import { GlyphMatrix as Upstream } from "@/components/magicui/glyph-matrix";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "glyphs" | "cellSize" | "mutationRate" | "interval" | "fadeBottom" | "color">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
