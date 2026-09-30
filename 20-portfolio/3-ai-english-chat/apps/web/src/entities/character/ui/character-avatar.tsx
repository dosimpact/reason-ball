"use client";

import Image from "next/image";
import { useState } from "react";
import type { Character } from "../model/types";

type CharacterAvatarProps = {
  character: Pick<Character, "name" | "emoji" | "palette" | "imageUrl">;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 text-xl",
  md: "h-16 w-16 text-3xl",
  lg: "h-28 w-28 text-6xl",
  hero: "h-44 w-full text-8xl sm:h-56",
};

export function CharacterAvatar({
  character,
  size = "md",
  className = "",
}: CharacterAvatarProps) {
  return (
    <div
      role="img"
      aria-label={`${character.name} 캐릭터 이미지`}
      className={`relative isolate grid shrink-0 place-items-center overflow-hidden bg-neutral-100 ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(145deg, ${character.palette[0]}, ${character.palette[1]})`,
      }}
    >
      <span className="absolute -right-5 -top-8 h-24 w-24 rounded-full bg-white/25 blur-sm" />
      <span className="absolute -bottom-8 -left-5 h-20 w-20 rounded-full bg-black/10 blur-sm" />
      {character.imageUrl ? <AvatarImage key={character.imageUrl} src={character.imageUrl} /> : null}
      <span className="relative drop-shadow-sm" aria-hidden="true">
        {character.emoji}
      </span>
    </div>
  );
}

// Keyed by URL so a changed image can recover from an earlier failed request.
function AvatarImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return null;
  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      loading="lazy"
      className={`z-10 object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}
