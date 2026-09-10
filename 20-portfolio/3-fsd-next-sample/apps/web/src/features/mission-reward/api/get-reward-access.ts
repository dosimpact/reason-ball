export type MissionRewardAccess = {
  unlockId: string;
  missionId: string;
  assetId: string;
  url: string;
  mimeType: string;
  altText: string;
  unlockedAt: string;
  expiresIn: number;
};

type RewardAccessResponse = {
  reward?: MissionRewardAccess;
};

function isSafeRewardUrl(value: string) {
  if (
    process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "mock" &&
    value.startsWith("data:image/svg+xml;base64,")
  ) {
    return true;
  }

  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function getMissionRewardAccess(missionId: string) {
  const response = await fetch(
    `/api/uploads/rewards/${encodeURIComponent(missionId)}`,
    {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(`Reward access failed (${response.status}).`);
  }

  const payload = (await response.json()) as RewardAccessResponse;
  if (
    !payload.reward ||
    payload.reward.missionId !== missionId ||
    !payload.reward.url ||
    !isSafeRewardUrl(payload.reward.url)
  ) {
    throw new Error("Reward access returned an invalid response.");
  }

  return payload.reward;
}
