"use client";
import { MorphingText as Upstream } from "@/components/magicui/morphing-text";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "texts">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream {...settings} texts={settings.texts ?? items} />;}
