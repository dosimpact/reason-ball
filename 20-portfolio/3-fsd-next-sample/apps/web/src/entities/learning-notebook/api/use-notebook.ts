"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { createHttpNotebook, remoteNotebookEnabled } from "./notebook-client";
import { localNotebookKey, withLocalNotebook } from "./local-notebook";
import type { SaveNotebookRequest } from "../model/notebook";

const notebookQueryKey = ["learning-notebook"] as const;
export function useLearningNotebook(enabled = true) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || remoteNotebookEnabled()) return;
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === localNotebookKey) void client.invalidateQueries({ queryKey: notebookQueryKey });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [client, enabled]);
  return useQuery({ queryKey: notebookQueryKey, enabled, retry: false, queryFn: async () => {
    if (!remoteNotebookEnabled()) return withLocalNotebook((repository) => repository.read());
    await ensureBrowserSession();
    return createHttpNotebook().read();
  } });
}

export function useSaveNotebook() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (request: SaveNotebookRequest) => {
    if (!remoteNotebookEnabled()) return withLocalNotebook((repository) => repository.save(request, new Date().toISOString()));
    await ensureBrowserSession();
    return createHttpNotebook().save(request);
  }, onSuccess: () => {
    void client.invalidateQueries({ queryKey: notebookQueryKey });
    void client.invalidateQueries({ queryKey: ["learning-progress"] });
  } });
}
