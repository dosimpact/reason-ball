"use client";
import { KineticText as Upstream } from "@/components/magicui/kinetic-text";
import type { MagicProps } from "./types";
export default function Example({text="Magic UI",}:MagicProps) {return <Upstream text={text} />;}
