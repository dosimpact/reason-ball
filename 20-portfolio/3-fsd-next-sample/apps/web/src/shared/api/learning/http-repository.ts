import type {
  Character,
  CharacterDraft,
  CompleteMissionInput,
  LearningHistory,
  LearningHistoryDraft,
  LearningRepository,
  LearningSnapshot,
  Mission,
  MissionDraft,
} from "./contracts";

type ItemsResponse<T> = { items: T[] };
type ItemResponse<T> = { item: T };
type SnapshotResponse = { snapshot: LearningSnapshot };
type FavoriteResponse = { favoriteCharacterIds: string[] };
type HistoryResponse = { history: LearningHistory };
type CompletionResponse = { result: unknown };

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = response.statusText || "Unknown error";
    try {
      const payload = (await response.json()) as {
        error?: string | { code?: string; message?: string };
        message?: string;
      };
      if (typeof payload.error === "string") {
        detail = payload.error;
      } else if (payload.error?.message) {
        detail = payload.error.code
          ? `${payload.error.code}: ${payload.error.message}`
          : payload.error.message;
      } else if (payload.message) {
        detail = payload.message;
      }
    } catch {
      // Keep the HTTP status text when the response is not JSON.
    }
    throw new Error(
      `Learning API ${init?.method ?? "GET"} ${path} failed (${response.status}): ${detail}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      `Learning API ${init?.method ?? "GET"} ${path} returned invalid JSON.`,
    );
  }
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

async function getSnapshot() {
  const payload = await requestJson<SnapshotResponse>("/api/me/learning");
  return requireValue(
    payload.snapshot,
    "Learning API GET /api/me/learning did not return { snapshot }.",
  );
}

export const httpLearningRepository: LearningRepository = {
  async listCharacters() {
    const payload = await requestJson<ItemsResponse<Character>>("/api/characters");
    return requireValue(
      payload.items,
      "Learning API GET /api/characters did not return { items }.",
    );
  },
  async getCharacter(id) {
    const path = `/api/characters/${encodeURIComponent(id)}`;
    const payload = await requestJson<ItemResponse<Character>>(path);
    return requireValue(
      payload.item,
      `Learning API GET ${path} did not return { item }.`,
    );
  },
  async createCharacter(draft: CharacterDraft) {
    const payload = await requestJson<ItemResponse<Character>>("/api/characters", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    return requireValue(
      payload.item,
      "Learning API POST /api/characters did not return { item }.",
    );
  },
  async updateCharacter(id, draft) {
    const path = `/api/characters/${encodeURIComponent(id)}`;
    const current = await requestJson<ItemResponse<Character>>(path);
    const payload = await requestJson<ItemResponse<Character>>(path, {
      method: "PATCH",
      body: JSON.stringify({
        action: "create-version",
        expectedVersion: Math.max(1, Number(current.item.versionNumber ?? 1)),
        draft,
      }),
    });
    return requireValue(
      payload.item,
      `Learning API PATCH ${path} did not return { item }.`,
    );
  },
  async listMissions() {
    const payload = await requestJson<ItemsResponse<Mission>>("/api/missions");
    return requireValue(
      payload.items,
      "Learning API GET /api/missions did not return { items }.",
    );
  },
  async getMission(id) {
    const path = `/api/missions/${encodeURIComponent(id)}`;
    const payload = await requestJson<ItemResponse<Mission>>(path);
    return requireValue(
      payload.item,
      `Learning API GET ${path} did not return { item }.`,
    );
  },
  async createMission(draft: MissionDraft) {
    const payload = await requestJson<ItemResponse<Mission>>("/api/missions", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    return requireValue(
      payload.item,
      "Learning API POST /api/missions did not return { item }.",
    );
  },
  async updateMission(id, draft) {
    const path = `/api/missions/${encodeURIComponent(id)}`;
    const current = await requestJson<ItemResponse<Mission>>(path);
    const payload = await requestJson<ItemResponse<Mission>>(path, {
      method: "PATCH",
      body: JSON.stringify({
        action: "create-version",
        expectedVersion: Math.max(1, Number(current.item.versionNumber ?? 1)),
        draft,
      }),
    });
    return requireValue(
      payload.item,
      `Learning API PATCH ${path} did not return { item }.`,
    );
  },
  getLearningSnapshot: getSnapshot,
  async toggleFavorite(characterId) {
    const path = `/api/me/favorites/${encodeURIComponent(characterId)}`;
    const payload = await requestJson<FavoriteResponse>(path, { method: "POST" });
    const current = await getSnapshot();
    return {
      ...current,
      favoriteCharacterIds: requireValue(
        payload.favoriteCharacterIds,
        `Learning API POST ${path} did not return { favoriteCharacterIds }.`,
      ),
    };
  },
  async touchHistory(history: LearningHistoryDraft) {
    const payload = await requestJson<HistoryResponse>("/api/me/history", {
      method: "POST",
      body: JSON.stringify(history),
    });
    const savedHistory = requireValue(
      payload.history,
      "Learning API POST /api/me/history did not return { history }.",
    );
    const current = await getSnapshot();
    return {
      ...current,
      histories: [
        savedHistory,
        ...current.histories.filter((item) => item.id !== savedHistory.id),
      ],
    };
  },
  async completeMission(input: CompleteMissionInput) {
    const { missionRunId, evaluationId, rewardId } = input;
    if (!missionRunId || !evaluationId || !rewardId) {
      throw new Error(
        "Completing a mission through the HTTP repository requires missionRunId, evaluationId, and rewardId.",
      );
    }
    const path = `/api/mission-runs/${encodeURIComponent(missionRunId)}/complete`;
    const payload = await requestJson<CompletionResponse>(path, {
      method: "POST",
      body: JSON.stringify({ evaluationId, rewardId }),
    });
    requireValue(
      payload.result,
      `Learning API POST ${path} did not return { result }.`,
    );
    return getSnapshot();
  },
};
