"use client";
import { Backlight as Upstream } from "@/components/magicui/backlight";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "blur">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} ><span>{text}</span></Upstream>;}
