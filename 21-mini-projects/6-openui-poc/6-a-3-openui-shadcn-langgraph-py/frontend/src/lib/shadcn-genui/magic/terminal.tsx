"use client";
import { Terminal as Upstream } from "@/components/magicui/terminal";
import { TypingAnimation } from "@/components/magicui/terminal";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "startOnView">>;
export default function Example({text="Magic UI",delay,...settings}:MagicProps & Settings & {delay?:number}) {return <Upstream {...settings}><TypingAnimation delay={delay}>{text}</TypingAnimation></Upstream>;}
