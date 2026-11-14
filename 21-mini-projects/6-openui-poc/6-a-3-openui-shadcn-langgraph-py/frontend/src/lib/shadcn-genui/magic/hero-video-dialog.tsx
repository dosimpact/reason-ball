"use client";
import { HeroVideoDialog as Upstream } from "@/components/magicui/hero-video-dialog";
import { sampleImage } from "./sample";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "videoSrc" | "thumbnailSrc" | "thumbnailAlt">>;
export default function Example({text="Magic UI",src,imageSrc,...settings}:MagicProps & Settings) {return <Upstream {...settings} videoSrc={src || settings.videoSrc || ""} thumbnailSrc={imageSrc || settings.thumbnailSrc || sampleImage} thumbnailAlt={settings.thumbnailAlt || text} />;}
