"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLearningRepository,
  learningQueryKeys,
} from "@/shared/api/learning";
import type { Character, CharacterDraft } from "../model/types";

export function useCharactersQuery() {
  return useQuery({
    queryKey: learningQueryKeys.characters(),
    queryFn: () => getLearningRepository().listCharacters(),
  });
}

export function useCharacterQuery(id: string | undefined) {
  return useQuery({
    queryKey: learningQueryKeys.character(id ?? "missing"),
    queryFn: () => getLearningRepository().getCharacter(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateCharacterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: CharacterDraft) =>
      getLearningRepository().createCharacter(draft),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: learningQueryKeys.ownedCreations() });
      queryClient.setQueryData<Character[]>(
        learningQueryKeys.characters(),
        (current) => [created, ...(current ?? []).filter((item) => item.id !== created.id)],
      );
      queryClient.setQueryData(
        learningQueryKeys.character(created.id),
        created,
      );
    },
  });
}

export function useUpdateCharacterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: CharacterDraft }) => {
      const updateCharacter = getLearningRepository().updateCharacter;
      if (!updateCharacter) {
        throw new Error("캐릭터 편집은 현재 mock 학습 저장소에서만 지원돼요.");
      }
      return updateCharacter(id, draft);
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: learningQueryKeys.ownedCreations() });
      queryClient.setQueryData<Character[]>(
        learningQueryKeys.characters(),
        (current) => [updated, ...(current ?? []).filter((item) => item.id !== updated.id)],
      );
      queryClient.setQueryData(learningQueryKeys.character(updated.id), updated);
    },
  });
}
