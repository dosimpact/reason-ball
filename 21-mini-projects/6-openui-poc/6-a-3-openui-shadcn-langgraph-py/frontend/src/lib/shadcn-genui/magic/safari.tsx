"use client";
import { Safari as Upstream } from "@/components/magicui/safari";
import { sampleImage } from "./sample";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "url" | "videoSrc">>;
export default function Example({imageSrc,...settings}:MagicProps & Settings) {return <Upstream {...settings} url="magicui.design" imageSrc={imageSrc || sampleImage} />;}
