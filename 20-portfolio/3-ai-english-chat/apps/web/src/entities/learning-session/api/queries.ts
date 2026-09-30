"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLearningRepository,
  learningQueryKeys,
} from "@/shared/api/learning";
import type {
  CompleteMissionInput,
  LearningHistoryDraft,
  LearningSnapshot,
} from "../model/types";

function useSnapshotMutation<TInput>(
  mutationFn: (input: TInput) => Promise<LearningSnapshot>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (nextSnapshot) => {
      queryClient.setQueryData(
        learningQueryKeys.snapshot(),
        nextSnapshot,
      );
    },
  });
}

export function useLearningSnapshotQuery() {
  return useQuery({
    queryKey: learningQueryKeys.snapshot(),
    queryFn: () => getLearningRepository().getLearningSnapshot(),
  });
}

export function useToggleFavoriteMutation() {
  return useSnapshotMutation((characterId: string) =>
    getLearningRepository().toggleFavorite(characterId),
  );
}

export function useTouchHistoryMutation() {
  return useSnapshotMutation((history: LearningHistoryDraft) =>
    getLearningRepository().touchHistory(history),
  );
}

export function useCompleteMissionMutation() {
  return useSnapshotMutation((input: CompleteMissionInput) =>
    getLearningRepository().completeMission(input),
  );
}
