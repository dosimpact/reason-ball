"use client";
import { Android as Upstream } from "@/components/magicui/android";
import { sampleImage } from "./sample";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "videoSrc">>;
export default function Example({imageSrc,...settings}:MagicProps & Settings) {return <Upstream {...settings} src={imageSrc || sampleImage} />;}
