"use client";
import { TypingAnimation as Upstream } from "@/components/magicui/typing-animation";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "words" | "typeSpeed" | "deleteSpeed" | "pauseDelay" | "loop" | "startOnView" | "showCursor" | "blinkCursor" | "cursorStyle" | "duration" | "delay">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {return <Upstream {...settings} >{text}</Upstream>;}
