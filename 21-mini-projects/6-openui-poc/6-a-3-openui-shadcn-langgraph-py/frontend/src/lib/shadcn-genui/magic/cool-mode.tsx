"use client";
import { CoolMode as Upstream } from "@/components/magicui/cool-mode";
import type { MagicProps } from "./types";
export default function Example({text="Magic UI",}:MagicProps) {return <Upstream><button className="rounded border px-5 py-3">{text}</button></Upstream>;}
