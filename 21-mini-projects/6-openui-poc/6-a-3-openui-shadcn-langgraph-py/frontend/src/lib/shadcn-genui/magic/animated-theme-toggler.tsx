"use client";
import { AnimatedThemeToggler as Upstream } from "@/components/magicui/animated-theme-toggler";
import { useState } from "react";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "fromCenter" | "theme" | "duration">>;
export default function Example({text="Magic UI",...settings}:MagicProps & Settings) {const [dark,setDark]=useState(settings.theme === "dark");return <div className={dark ? "dark rounded bg-zinc-900 p-6 text-white" : "rounded bg-white p-6 text-black"}><Upstream {...settings} theme={dark ? "dark" : "light"} onThemeChange={theme=>setDark(theme === "dark")} /><p>{text}</p></div>;}
