"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLearningRepository, learningQueryKeys } from "@/shared/api/learning";
import {
  completeMissionRun,
  evaluateMission,
  getMissionRun,
  getReviewNote,
  listMissionRuns,
  saveReviewNote,
  startMissionRun,
  updateMissionProgress,
} from "./client";
import type {
  CompleteMissionRunInput,
  EvaluateMissionInput,
  MissionRun,
  StartMissionRunInput,
  UpdateMissionProgressInput,
} from "../model/types";

export const missionRunQueryKeys = {
  all: ["mission-runs"] as const,
  list: () => [...missionRunQueryKeys.all, "list"] as const,
  detail: (runId: string) => [...missionRunQueryKeys.all, "detail", runId] as const,
  reviewNote: (runId: string) =>
    [...missionRunQueryKeys.detail(runId), "review-note"] as const,
};

function replaceRun(current: MissionRun[] | undefined, run: MissionRun) {
  return [run, ...(current ?? []).filter((item) => item.id !== run.id)];
}

function useUpdateRunCache() {
  const queryClient = useQueryClient();
  return (run: MissionRun) => {
    queryClient.setQueryData(missionRunQueryKeys.detail(run.id), run);
    queryClient.setQueryData<MissionRun[]>(missionRunQueryKeys.list(), (current) =>
      replaceRun(current, run),
    );
  };
}

export function useMissionRunsQuery() {
  return useQuery({ queryKey: missionRunQueryKeys.list(), queryFn: listMissionRuns });
}

export function useMissionRunQuery(runId?: string) {
  return useQuery({
    queryKey: missionRunQueryKeys.detail(runId ?? "missing"),
    queryFn: () => getMissionRun(runId as string),
    enabled: Boolean(runId),
  });
}

export function useStartMissionRunMutation() {
  const updateRun = useUpdateRunCache();
  return useMutation({
    mutationFn: (input: StartMissionRunInput) => startMissionRun(input),
    onSuccess: updateRun,
  });
}

export function useUpdateMissionProgressMutation() {
  const updateRun = useUpdateRunCache();
  return useMutation({
    mutationFn: (input: UpdateMissionProgressInput) => updateMissionProgress(input),
    onSuccess: updateRun,
  });
}

export function useEvaluateMissionMutation() {
  const updateRun = useUpdateRunCache();
  return useMutation({
    mutationFn: (input: EvaluateMissionInput) => evaluateMission(input),
    onSuccess: ({ run }) => updateRun(run),
  });
}

export function useCompleteMissionRunMutation() {
  const queryClient = useQueryClient();
  const updateRun = useUpdateRunCache();
  return useMutation({
    mutationFn: (input: CompleteMissionRunInput) => completeMissionRun(input),
    onSuccess: async ({ run }) => {
      updateRun(run);
      if (process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "mock") {
        const snapshot = await getLearningRepository().completeMission({
          missionId: run.missionId,
        });
        queryClient.setQueryData(learningQueryKeys.snapshot(), snapshot);
      }
    },
  });
}

export function useReviewNoteQuery(runId?: string) {
  return useQuery({
    queryKey: missionRunQueryKeys.reviewNote(runId ?? "missing"),
    queryFn: () => getReviewNote(runId as string),
    enabled: Boolean(runId),
  });
}

export function useSaveReviewNoteMutation(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => saveReviewNote(runId, note),
    onSuccess: (saved) => {
      queryClient.setQueryData(missionRunQueryKeys.reviewNote(runId), saved);
      queryClient.setQueryData<MissionRun>(missionRunQueryKeys.detail(runId), (current) =>
        current ? { ...current, reviewNote: saved.note } : current,
      );
      queryClient.setQueryData<MissionRun[]>(missionRunQueryKeys.list(), (current) =>
        current?.map((run) =>
          run.id === runId ? { ...run, reviewNote: saved.note } : run,
        ),
      );
    },
  });
}
