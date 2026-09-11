"use client";

import { LockKeyhole, Sparkles } from "lucide-react";

import { useLearningSnapshotQuery } from "@/entities/learning-session";
import type { Mission } from "@/entities/mission";

import { useMissionRewardAccess } from "../model/use-mission-reward-access";

type MissionRewardProps = {
  mission: Pick<Mission, "id" | "rewardTitle" | "rewardPalette" | "rewardEmoji">;
  compact?: boolean;
};

export function MissionReward({
  mission,
  compact = false,
}: MissionRewardProps) {
  const { data: learning } = useLearningSnapshotQuery();
  const unlocked = learning?.unlockedRewardIds.includes(mission.id) ?? false;
  const rewardAccess = useMissionRewardAccess(mission.id, unlocked);
  const signedRewardUrl = unlocked ? rewardAccess.data?.url : undefined;
  const rewardState = !unlocked
    ? "locked"
    : rewardAccess.isPending
      ? "loading"
      : signedRewardUrl
        ? "ready"
        : "error";

  return (
    <div
      className={`relative isolate overflow-hidden rounded-[1.5rem] ${compact ? "min-h-40 p-5" : "min-h-72 p-7"}`}
      style={{
        backgroundImage: signedRewardUrl
          ? `linear-gradient(to top, rgba(0,0,0,.65), rgba(0,0,0,.05)), url(${signedRewardUrl})`
          : `linear-gradient(145deg, ${mission.rewardPalette[0]}, ${mission.rewardPalette[1]})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      data-testid={`reward-${mission.id}`}
      data-reward-state={rewardState}
      aria-busy={rewardState === "loading"}
    >
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/20 blur-xl" />
      <div
        className={`relative flex h-full flex-col ${unlocked ? "justify-between" : "items-center justify-center text-center"} text-white`}
      >
        {unlocked ? (
          <>
            {!signedRewardUrl ? (
              <span className={compact ? "text-5xl" : "text-7xl"}>
                {mission.rewardEmoji}
              </span>
            ) : (
              <span />
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">
                Unlocked scene
              </p>
              <p className="mt-1 font-bold">{mission.rewardTitle}</p>
              {rewardAccess.isError ? (
                <p className="mt-1 text-[11px] text-white/70" role="status">
                  보상 원본을 불러오지 못했어요.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="relative h-24 w-36">
              {/* A local silhouette conceals the scene without fetching its private original. */}
              <svg viewBox="0 0 144 96" role="img" aria-label="잠긴 보상 실루엣" className="h-full w-full text-black/35" data-testid="reward-locked-silhouette">
                <circle cx="72" cy="26" r="19" fill="currentColor" />
                <path d="M29 92V80c0-23 18-36 43-36s43 13 43 36v12Z" fill="currentColor" />
              </svg>
              <span aria-hidden="true" className="absolute bottom-0 right-3 grid size-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur">
                <LockKeyhole className="size-5" />
              </span>
            </div>
            <p className="mt-4 font-bold">완료하면 열리는 장면</p>
            <p className="mt-1 text-xs text-white/65">
              {mission.rewardTitle}
            </p>
          </>
        )}
      </div>
      {unlocked ? (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
          <Sparkles className="size-3" /> 해금됨
        </span>
      ) : null}
    </div>
  );
}
