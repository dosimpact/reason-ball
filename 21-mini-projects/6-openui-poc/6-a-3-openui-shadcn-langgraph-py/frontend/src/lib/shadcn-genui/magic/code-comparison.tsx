"use client";
import { CodeComparison as Upstream } from "@/components/magicui/code-comparison";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "language" | "filename" | "lightTheme" | "darkTheme" | "highlightColor">>;
export default function Example({beforeCode="const value = 1;",afterCode="const value = 2;",...settings}:MagicProps & Settings) {return <Upstream {...settings} beforeCode={beforeCode} afterCode={afterCode} language={settings.language ?? "typescript"} filename={settings.filename ?? "example.ts"} lightTheme={settings.lightTheme ?? "github-light"} darkTheme={settings.darkTheme ?? "github-dark"} />;}
