"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLearningRepository,
  learningQueryKeys,
} from "@/shared/api/learning";
import type { Mission, MissionDraft } from "../model/types";

export function useMissionsQuery() {
  return useQuery({
    queryKey: learningQueryKeys.missions(),
    queryFn: () => getLearningRepository().listMissions(),
  });
}

export function useMissionQuery(id: string | undefined) {
  return useQuery({
    queryKey: learningQueryKeys.mission(id ?? "missing"),
    queryFn: () => getLearningRepository().getMission(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateMissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: MissionDraft) =>
      getLearningRepository().createMission(draft),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: learningQueryKeys.ownedCreations() });
      queryClient.setQueryData<Mission[]>(
        learningQueryKeys.missions(),
        (current) => [created, ...(current ?? []).filter((item) => item.id !== created.id)],
      );
      queryClient.setQueryData(learningQueryKeys.mission(created.id), created);
    },
  });
}

export function useUpdateMissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: MissionDraft }) => {
      const updateMission = getLearningRepository().updateMission;
      if (!updateMission) {
        throw new Error("미션 편집은 현재 mock 학습 저장소에서만 지원돼요.");
      }
      return updateMission(id, draft);
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: learningQueryKeys.ownedCreations() });
      queryClient.setQueryData<Mission[]>(
        learningQueryKeys.missions(),
        (current) => [updated, ...(current ?? []).filter((item) => item.id !== updated.id)],
      );
      queryClient.setQueryData(learningQueryKeys.mission(updated.id), updated);
    },
  });
}
