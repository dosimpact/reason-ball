"use client";
import { HexagonPattern as Upstream } from "@/components/magicui/hexagon-pattern";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "radius" | "gap" | "x" | "y" | "direction" | "strokeDasharray">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
