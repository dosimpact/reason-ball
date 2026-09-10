"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { getLearningRepository } from "@/shared/api/learning";
import { savedMissionListSchema, type SavedMissionRequest } from "../model/saved-missions";
import { savedMissionsStorageKey, withLocalSavedMissions } from "./local-saved-missions";
import { createHttpSavedMissions, remoteSavedMissionsEnabled } from "./saved-missions-client";

const key = ["saved-missions"] as const;
export function useSavedMissions() {
  const client = useQueryClient();
  useEffect(() => {
    if (remoteSavedMissionsEnabled()) return;
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === savedMissionsStorageKey) void client.invalidateQueries({ queryKey: key });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [client]);
  return useQuery({ queryKey: key, retry: false, queryFn: async () => {
    if (remoteSavedMissionsEnabled()) { await ensureBrowserSession(); return createHttpSavedMissions().read(); }
    const state = await withLocalSavedMissions((repository) => repository.read());
    const missions = await getLearningRepository().listMissions();
    return savedMissionListSchema.parse(state.entries.map((entry) => {
      const mission = missions.find((item) => item.id === entry.missionId && item.publishStatus !== "archived");
      return { ...entry, mission: mission ? { id: mission.id, title: mission.title, summary: mission.subtitle } : null };
    }));
  } });
}

export function useSetSavedMission() {
  const client = useQueryClient();
  return useMutation({ scope: { id: "saved-missions" }, mutationFn: async (request: SavedMissionRequest) => {
    if (remoteSavedMissionsEnabled()) { await ensureBrowserSession(); return createHttpSavedMissions().set(request); }
    return withLocalSavedMissions(async (repository) => {
      const replay = repository.read().receipts.some((receipt) => receipt.request.requestId === request.requestId);
      if (request.saved && !replay) {
        const mission = await getLearningRepository().getMission(request.missionId);
        if (!mission || mission.publishStatus === "archived") throw new Error("지금 저장할 수 없는 미션이에요.");
      }
      return repository.set(request, new Date().toISOString());
    });
  }, onSuccess: async () => {
    // A replay acknowledges a past action. Only a fresh read determines the
    // present state; never overwrite the list with the receipt's saved flag.
    await client.invalidateQueries({ queryKey: key });
  } });
}
