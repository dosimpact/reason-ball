"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { progressSourceSchema, summarizeLearningProgress } from "../model/progress";
import { localActivityKey, withLocalActivity } from "./local-activity-repository";

const remote = process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock" && process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase";

export function useLearningProgressQuery() {
  const client = useQueryClient();
  useEffect(() => {
    if (remote) return;
    const changed = (event: StorageEvent) => {
      if (event.key === localActivityKey || event.key === null) void client.invalidateQueries({ queryKey: ["learning-progress"] });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [client]);
  return useQuery({
    queryKey: ["learning-progress"], retry: false,
    queryFn: async () => {
      if (!remote) {
        const now = Date.now();
        const stored = await withLocalActivity((repository) => repository.read(now));
        return summarizeLearningProgress({ today: new Date(now).toISOString().slice(0, 10), days: stored.days, expressionCount: 0, source: "demo" });
      }
      await ensureBrowserSession();
      const response = await fetch("/api/me/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("학습 진도를 불러오지 못했어요.");
      const body = await response.json();
      return summarizeLearningProgress(progressSourceSchema.parse(body.progress));
    },
  });
}
