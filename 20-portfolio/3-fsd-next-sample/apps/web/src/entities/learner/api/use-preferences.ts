"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { createHttpPreferences, createLocalPreferences, preferenceStorageKey, legacyPreferenceStorageKey, remotePreferencesEnabled } from "./preferences-repository";
import type { LearningPreferences, PreferenceRecord } from "../model/preferences";

const key = ["learner-preferences"] as const;
export function useLearningPreferences(enabled = true) {
  const client = useQueryClient();
  const remote = remotePreferencesEnabled();
  const query = useQuery({
    queryKey: key, enabled, retry: false, staleTime: 0,
    queryFn: async () => {
      if (remote) { await ensureBrowserSession(); return createHttpPreferences().read(); }
      return createLocalPreferences(window.localStorage).read();
    },
  });
  useEffect(() => {
    if (remote || !enabled) return;
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === preferenceStorageKey || event.key === legacyPreferenceStorageKey) void client.invalidateQueries({ queryKey: key });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [client, enabled, remote]);
  const mutation = useMutation({
    mutationFn: async ({ previous, settings }: { previous: PreferenceRecord; settings: LearningPreferences }) => {
      if (remote) return createHttpPreferences().save(previous, settings);
      const save = () => createLocalPreferences(window.localStorage).save(previous, settings);
      return navigator.locks ? navigator.locks.request(preferenceStorageKey, save) : save();
    },
    onSuccess: (saved) => client.setQueryData(key, saved),
  });
  return { ...query, save: mutation.mutateAsync, saving: mutation.isPending, remote };
}
