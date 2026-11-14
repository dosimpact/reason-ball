"use client";
import { StripedPattern as Upstream } from "@/components/magicui/striped-pattern";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "direction">>;
export default function Example({...settings}:MagicProps & Settings) {return <Upstream {...settings}  />;}
