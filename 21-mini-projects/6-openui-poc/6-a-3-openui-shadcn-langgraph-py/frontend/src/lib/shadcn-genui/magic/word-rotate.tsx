"use client";
import { WordRotate as Upstream } from "@/components/magicui/word-rotate";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "words" | "duration">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream {...settings} words={settings.words ?? items} />;}
