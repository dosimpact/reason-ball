"use client";
import { DiaTextReveal as Upstream } from "@/components/magicui/dia-text-reveal";
import type { MagicProps } from "./types";
export default function Example({text="Magic UI",}:MagicProps) {return <Upstream text={text} />;}
