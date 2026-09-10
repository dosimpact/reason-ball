import { MessageCircle, Star, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Character } from "../model/types";
import { CharacterAvatar } from "./character-avatar";

type CharacterCardProps = {
  character: Character;
  action?: ReactNode;
};

export function CharacterCard({ character, action }: CharacterCardProps) {
  return (
    <article
      className="group overflow-hidden rounded-[1.6rem] border border-black/6 bg-white shadow-[0_16px_50px_-35px_rgba(25,18,8,.55)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-30px_rgba(25,18,8,.35)]"
      data-testid={`character-card-${character.id}`}
    >
      <div className="relative">
        <CharacterAvatar character={character} size="hero" />
        <div className="absolute left-4 top-4 rounded-full border border-white/40 bg-white/85 px-3 py-1 text-xs font-semibold text-neutral-800 backdrop-blur">
          {character.level}
        </div>
        {action ? <div className="absolute right-4 top-4">{action}</div> : null}
      </div>
      <div className="space-y-4 p-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold tracking-tight">{character.name}</h3>
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Star className="size-3.5 fill-current" aria-hidden="true" />
              {character.rating.toFixed(1)}
            </div>
          </div>
          <p className="mt-1 text-sm font-medium text-[#e16748]">{character.role}</p>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-neutral-600">
          {character.tagline}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {character.personality.slice(0, 3).map((item) => (
            <span
              key={item}
              className="rounded-full bg-[#f5f1eb] px-2.5 py-1 text-[11px] font-semibold text-neutral-600"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-black/6 pt-4">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Users className="size-3.5" aria-hidden="true" />
            {character.learnerCount.toLocaleString("ko-KR")}명 학습
          </span>
          <Link
            href={`/characters/${character.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#e16748] focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`${character.name} 상세 보기`}
          >
            만나기 <MessageCircle className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

