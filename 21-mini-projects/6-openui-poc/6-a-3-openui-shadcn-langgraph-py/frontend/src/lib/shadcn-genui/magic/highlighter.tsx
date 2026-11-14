"use client";
import { Highlighter as Upstream } from "@/components/magicui/highlighter";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "color" | "strokeWidth" | "animationDuration" | "iterations" | "padding" | "multiline" | "isView">>;
export default function Example({text="Magic UI",...settings}:Omit<MagicProps,"action"> & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
