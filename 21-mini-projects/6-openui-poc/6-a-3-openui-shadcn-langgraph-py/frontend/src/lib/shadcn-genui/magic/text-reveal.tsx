"use client";
import { TextReveal as Upstream } from "@/components/magicui/text-reveal";
import type { MagicProps } from "./types";
export default function Example({text="Magic UI",}:MagicProps) {return <Upstream >{text}</Upstream>;}
