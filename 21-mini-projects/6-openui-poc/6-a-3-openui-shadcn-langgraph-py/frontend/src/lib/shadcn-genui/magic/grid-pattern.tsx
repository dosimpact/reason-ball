"use client";
import { GridPattern as Upstream } from "@/components/magicui/grid-pattern";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "x" | "y" | "strokeDasharray">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
