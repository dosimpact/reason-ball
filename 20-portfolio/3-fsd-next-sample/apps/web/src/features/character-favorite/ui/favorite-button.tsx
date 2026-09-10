"use client";

import { Heart } from "lucide-react";
import {
  useLearningSnapshotQuery,
  useToggleFavoriteMutation,
} from "@/entities/learning-session";

type FavoriteButtonProps = {
  characterId: string;
  characterName: string;
  className?: string;
};

export function FavoriteButton({
  characterId,
  characterName,
  className = "",
}: FavoriteButtonProps) {
  const { data: learning } = useLearningSnapshotQuery();
  const { mutate: toggleFavorite, isPending } = useToggleFavoriteMutation();
  const isFavorite = learning?.favoriteCharacterIds.includes(characterId) ?? false;

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(characterId)}
      disabled={isPending}
      className={`grid size-10 place-items-center rounded-full border border-white/40 bg-white/90 text-neutral-700 shadow-sm backdrop-blur transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      aria-label={`${characterName} ${isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
      aria-pressed={isFavorite}
      data-testid={`favorite-${characterId}`}
    >
      <Heart
        className={`size-4.5 ${isFavorite ? "fill-[#f06f52] text-[#f06f52]" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}
