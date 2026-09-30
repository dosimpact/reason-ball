"use client";

import { useQuery } from "@tanstack/react-query";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { readMockOwnedContent } from "@/shared/api/learning/mock-repository";
import { learningQueryKeys } from "@/shared/api/learning/query-keys";
import { creationsSchema } from "../model/creations";

const key = learningQueryKeys.ownedCreations();
const remote = process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock" && process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase";

export function useOwnedCreations() {
  return useQuery({ queryKey: key, retry: false, staleTime: 0, queryFn: async () => {
    if (remote) {
      await ensureBrowserSession();
      const response = await fetch("/api/me/creations", { cache: "no-store" });
      if (!response.ok) throw new Error("내 생성물을 불러오지 못했어요.");
      return creationsSchema.parse((await response.json()).creations);
    }
    const owned = readMockOwnedContent();
    return creationsSchema.parse({ source: "browser", items: [
      ...owned.characters.map((item) => ({ kind: "character", id: item.id, title: item.name, summary: item.tagline, status: item.publishStatus ?? "draft" })),
      ...owned.missions.map((item) => ({ kind: "mission", id: item.id, title: item.title, summary: item.subtitle, status: item.publishStatus ?? "draft" })),
    ] });
  } });
}
