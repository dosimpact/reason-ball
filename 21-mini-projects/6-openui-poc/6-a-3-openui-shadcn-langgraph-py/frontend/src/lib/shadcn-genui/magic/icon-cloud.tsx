"use client";
import { IconCloud as Upstream } from "@/components/magicui/icon-cloud";
import { sampleImage } from "./sample";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "images" | "showControl">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream {...settings} images={settings.images ?? items.map(()=>sampleImage)} />;}
