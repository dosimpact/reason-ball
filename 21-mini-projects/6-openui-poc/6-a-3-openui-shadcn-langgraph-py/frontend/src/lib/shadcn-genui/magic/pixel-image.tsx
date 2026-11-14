"use client";
import { PixelImage as Upstream } from "@/components/magicui/pixel-image";
import { sampleImage } from "./sample";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "grayscaleAnimation">>;
export default function Example({imageSrc,...settings}:MagicProps & Settings) {return <Upstream {...settings} src={imageSrc || sampleImage} />;}
