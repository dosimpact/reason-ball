"use client";
import { Lens as Upstream } from "@/components/magicui/lens";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "zoomFactor" | "lensSize" | "isStatic" | "lensColor" | "ariaLabel" | "duration">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
