"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getMissionRewardAccess } from "../api/get-reward-access";

export const missionRewardAccessKeys = {
  detail: (missionId: string) => ["mission-reward-access", missionId] as const,
};

export function useMissionRewardAccess(
  missionId: string,
  unlocked: boolean,
) {
  const queryClient = useQueryClient();
  const queryKey = missionRewardAccessKeys.detail(missionId);
  const query = useQuery({
    queryKey,
    queryFn: () => getMissionRewardAccess(missionId),
    enabled: unlocked,
    staleTime: 45_000,
    retry: false,
  });

  useEffect(() => {
    if (!unlocked) {
      queryClient.removeQueries({
        exact: true,
        queryKey: missionRewardAccessKeys.detail(missionId),
      });
    }
  }, [missionId, queryClient, unlocked]);

  return query;
}
