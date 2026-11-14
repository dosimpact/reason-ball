"use client";
import { AvatarCircles as Upstream } from "@/components/magicui/avatar-circles";
import { sampleImage } from "./sample";
import type { MagicProps } from "./types";
import type { ComponentProps } from "react";
type Settings = Partial<Pick<ComponentProps<typeof Upstream>, "numPeople">>;
export default function Example({items=["Design","Build","Ship"],...settings}:MagicProps & Settings) {return <Upstream {...settings} numPeople={99} avatarUrls={items.map(()=>({imageUrl:sampleImage,profileUrl:"https://example.com"}))} />;}
