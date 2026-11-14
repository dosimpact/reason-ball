"use client";
import { LineShadowText as Upstream } from "@/components/magicui/line-shadow-text";
import type { MagicProps } from "./types";
export default function Example({text="Magic UI",}:MagicProps) {return <Upstream >{text}</Upstream>;}
