import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Character } from "../model/types";
import { CharacterAvatar } from "./character-avatar";

type CharacterCardProps = { character: Character; action?: ReactNode };

export function CharacterCard({ character, action }: CharacterCardProps) {
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl bg-card text-card-foreground transition duration-300 hover:-translate-y-1" data-testid={`character-card-${character.id}`}>
      <Link href={`/characters/${character.id}`} aria-label={`${character.name} 상세 보기`} className="block focus-visible:outline-2 focus-visible:outline-offset-2">
        <div className="relative overflow-hidden">
          <CharacterAvatar character={character} size="hero" className="!h-auto aspect-[3/4] transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-4 pt-14 text-white">
            <h3 className="truncate text-xl font-bold tracking-tight">{character.name}</h3>
            <p className="mt-1 truncate text-xs text-white/75">{character.role}</p>
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">{character.level}</span>
        </div>
        <div className="space-y-3 p-4">
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{character.tagline}</p>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="truncate">{character.personality.slice(0, 2).map(item => `#${item}`).join(" ")}</span><span className="flex shrink-0 items-center gap-1"><MessageCircle className="size-3" />{character.learnerCount.toLocaleString("ko-KR")}개 대화</span></div>
        </div>
      </Link>
      {action ? <div className="absolute right-3 top-3 z-10">{action}</div> : null}
    </article>
  );
}
