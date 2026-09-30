"use client";

import { useQuery } from "@tanstack/react-query";
import type { Mission } from "@/entities/mission";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { formatRewardAcquiredDate } from "../model/reward-acquired-date";
import { MissionReward } from "./mission-reward";

type EarnedReward = { id: string; unlockId: string; unlockedAt: string; title: string; metadataSource: "published-version" | "unavailable" };

export function RewardCollection({ missions, rewardIds }: { missions: Mission[]; rewardIds: string[] }) {
  const remote = process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase" && process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock";
  const earned = useQuery({
    queryKey: ["learning", "earned-rewards"], enabled: remote,
    queryFn: async () => {
      await ensureBrowserSession();
      const response = await fetch("/api/me/earned-rewards", { cache: "no-store" });
      if (!response.ok) throw new Error("획득한 보상을 불러오지 못했어요.");
      return (await response.json()).items as EarnedReward[];
    },
  });
  const items: Array<Pick<Mission, "id" | "title" | "rewardTitle" | "rewardPalette" | "rewardEmoji">> = remote
    ? [...(earned.data ?? []).map(item => ({ id: item.id, title: item.title, rewardTitle: `${item.title} 완료 장면`, rewardPalette: ["#5763d7", "#e16748"] as [string, string], rewardEmoji: "✨" })), ...missions.filter(mission => !(earned.data ?? []).some(item => item.id === mission.id))]
    : missions;
  return <section className="mt-8" data-testid="reward-collection">
    <div className="mb-6"><p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">Unlocked memories</p><h2 className="mt-1 text-2xl font-black">캐릭터와 만든 장면들</h2></div>
    {remote && earned.isPending ? <p role="status">획득한 보상을 불러오고 있어요.</p> : null}
    {earned.error ? <div role="alert">{earned.error.message}<button type="button" onClick={() => void earned.refetch()} className="ml-3 underline">보상 컬렉션 다시 불러오기</button></div> : null}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(mission => {
      const unlock = earned.data?.find(item => item.id === mission.id);
      const date = unlock ? formatRewardAcquiredDate(unlock.unlockedAt) : null;
      return <div key={mission.id}>
        <MissionReward mission={mission} compact />
        <p className="mt-2 text-center text-xs font-semibold text-neutral-500">{rewardIds.includes(mission.id) ? mission.title : "아직 잠긴 미션 보상"}</p>
        {rewardIds.includes(mission.id) && unlock && date ? <p className="mt-1 text-center text-xs text-neutral-500">
          획득일 <time dateTime={unlock.unlockedAt} data-testid={`reward-acquired-${mission.id}`}>{date}</time>
        </p> : null}
      </div>;
    })}</div>
  </section>;
}
