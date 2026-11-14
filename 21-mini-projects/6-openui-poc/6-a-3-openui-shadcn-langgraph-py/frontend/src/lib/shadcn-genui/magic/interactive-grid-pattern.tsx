"use client";
import { InteractiveGridPattern as Upstream } from "@/components/magicui/interactive-grid-pattern";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "squaresClassName">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
