"use client";
import { VideoText as Upstream } from "@/components/magicui/video-text";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "autoPlay" | "muted" | "loop" | "preload" | "textAnchor" | "dominantBaseline" | "fontFamily">>;
export default function Example({text="Magic UI",src,...settings}:MagicProps & Settings) {if(!src)return <div className="p-8 text-center text-4xl font-bold" data-video-placeholder>{text}<p className="text-sm font-normal">Provide a video src to animate this text.</p></div>;return <div className="h-48 w-full"><Upstream {...settings} src={src || ""}>{text}</Upstream></div>;}
