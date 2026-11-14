"use client";
import { FlickeringGrid as Upstream } from "@/components/magicui/flickering-grid";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "squareSize" | "gridGap" | "flickerChance" | "color" | "maxOpacity">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
