import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
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
  PublishStatus,
} from "./contracts";
import { initialHistories, seedCharacters, seedMissions } from "./mock-data";
import { migrateMockOwnership } from "./mock-ownership";

const STORAGE_KEY = "lingua-character-lab";
const STORAGE_VERSION = 2;
let ownershipLoadError: unknown;

function assertOwnershipLoaded() {
  if (ownershipLoadError) throw new Error("기존 브라우저 생성물 기록을 읽지 못했어요. 저장 데이터를 초기화하지 않았습니다.");
}

type MockLearningData = LearningSnapshot & {
  characters: Character[];
  missions: Mission[];
  ownedCharacterIds: string[];
  ownedMissionIds: string[];
};

type MockLearningStore = MockLearningData & {
  addCharacter(draft: CharacterDraft): Character;
  updateCharacter(id: string, draft: CharacterDraft): Character;
  addMission(draft: MissionDraft): Mission;
  updateMission(id: string, draft: MissionDraft): Mission;
  toggleFavorite(characterId: string): void;
  touchHistory(history: LearningHistoryDraft): void;
  completeMission(missionId: string): void;
};

const initialData: MockLearningData = {
  characters: seedCharacters,
  missions: seedMissions,
  ownedCharacterIds: [],
  ownedMissionIds: [],
  favoriteCharacterIds: ["mia-hotelier"],
  completedMissionIds: [],
  unlockedRewardIds: [],
  histories: initialHistories,
  streak: 7,
  xp: 1280,
  weeklyMinutes: 42,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(prefix: string, ids: string[]) {
  const base = slugify(prefix) || "item";
  let suffix = 1;
  while (ids.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function deterministicTimestamp(offset: number) {
  return new Date(Date.UTC(2026, 8, 5, 12, 0, offset)).toISOString();
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function omitKeys<T extends object, const K extends readonly (keyof T)[]>(
  value: T,
  keys: K,
): Omit<T, K[number]> {
  const copy = cloneValue(value);
  keys.forEach((key) => Reflect.deleteProperty(copy, key));
  return copy;
}

function assertStatusTransition(current: PublishStatus, next: PublishStatus) {
  const allowed: Record<PublishStatus, PublishStatus[]> = {
    draft: ["draft", "published"],
    published: ["published", "archived"],
    archived: [],
  };
  if (!allowed[current].includes(next)) {
    throw new Error(
      current === "archived"
        ? "보관된 콘텐츠는 새 버전을 만들 수 없어요."
        : `${current} 상태에서 ${next} 상태로 변경할 수 없어요.`,
    );
  }
}

function characterDraftFrom(character: Character): CharacterDraft {
  return omitKeys(character, [
    "id",
    "creator",
    "learnerCount",
    "rating",
    "createdAt",
    "versionNumber",
    "versionHistory",
    "metadataSource",
  ] as const);
}

function missionDraftFrom(mission: Mission): MissionDraft {
  return omitKeys(mission, [
    "id",
    "learnerCount",
    "createdAt",
    "versionNumber",
    "versionHistory",
    "metadataSource",
  ] as const);
}

function nextHistoryTimestamp(histories: LearningHistory[]) {
  const latest = histories.reduce(
    (timestamp, history) => Math.max(timestamp, Date.parse(history.lastActiveAt)),
    Date.UTC(2026, 8, 5, 12),
  );
  return new Date(latest + 1_000).toISOString();
}

const mockLearningStore = createStore<MockLearningStore>()(
  persist(
    (set, get) => ({
      ...initialData,
      addCharacter: (draft) => {
        assertOwnershipLoaded();
        const state = get();
        const createdAt = deterministicTimestamp(
          state.characters.length + state.missions.length,
        );
        const snapshot = cloneValue({ ...draft, publishStatus: draft.publishStatus ?? "draft" });
        const character: Character = {
          ...snapshot,
          id: uniqueId(
            draft.name || "character",
            state.characters.map((item) => item.id),
          ),
          creator: "나",
          learnerCount: 0,
          rating: 5,
          createdAt,
          versionNumber: 1,
          versionHistory: [{ versionNumber: 1, status: snapshot.publishStatus ?? "draft", createdAt, snapshot }],
        };
        set({ characters: [character, ...state.characters], ownedCharacterIds: [...state.ownedCharacterIds, character.id] });
        return character;
      },
      updateCharacter: (id, draft) => {
        assertOwnershipLoaded();
        const state = get();
        const current = state.characters.find((item) => item.id === id);
        if (!current) throw new Error("수정할 캐릭터를 찾을 수 없어요.");
        if (!state.ownedCharacterIds.includes(id)) throw new Error("직접 만든 캐릭터만 수정할 수 있어요.");
        const currentStatus = current.publishStatus ?? "draft";
        const nextStatus = draft.publishStatus ?? currentStatus;
        assertStatusTransition(currentStatus, nextStatus);
        const currentVersion = current.versionNumber ?? current.versionHistory?.at(-1)?.versionNumber ?? 1;
        const existingHistory = current.versionHistory?.length
          ? cloneValue(current.versionHistory)
          : [{
              versionNumber: currentVersion,
              status: currentStatus,
              createdAt: current.createdAt,
              snapshot: characterDraftFrom(current),
            }];
        const versionNumber = currentVersion + 1;
        const createdAt = deterministicTimestamp(
          state.characters.length + state.missions.length + versionNumber,
        );
        const snapshot = cloneValue({ ...draft, publishStatus: nextStatus });
        const updated: Character = {
          ...current,
          ...snapshot,
          versionNumber,
          versionHistory: [
            ...existingHistory,
            { versionNumber, status: nextStatus, createdAt, snapshot },
          ],
        };
        set({ characters: state.characters.map((item) => item.id === id ? updated : item) });
        return updated;
      },
      addMission: (draft) => {
        assertOwnershipLoaded();
        const state = get();
        const createdAt = deterministicTimestamp(
          state.characters.length + state.missions.length,
        );
        const snapshot = cloneValue({ ...draft, publishStatus: draft.publishStatus ?? "draft" });
        const mission: Mission = {
          ...snapshot,
          id: uniqueId(
            draft.title || "mission",
            state.missions.map((item) => item.id),
          ),
          learnerCount: 0,
          createdAt,
          versionNumber: 1,
          versionHistory: [{ versionNumber: 1, status: snapshot.publishStatus ?? "draft", createdAt, snapshot }],
        };
        set({ missions: [mission, ...state.missions], ownedMissionIds: [...state.ownedMissionIds, mission.id] });
        return mission;
      },
      updateMission: (id, draft) => {
        assertOwnershipLoaded();
        const state = get();
        const current = state.missions.find((item) => item.id === id);
        if (!current) throw new Error("수정할 미션을 찾을 수 없어요.");
        if (!state.ownedMissionIds.includes(id)) throw new Error("직접 만든 미션만 수정할 수 있어요.");
        const currentStatus = current.publishStatus ?? "draft";
        const nextStatus = draft.publishStatus ?? currentStatus;
        assertStatusTransition(currentStatus, nextStatus);
        const currentVersion = current.versionNumber ?? current.versionHistory?.at(-1)?.versionNumber ?? 1;
        const existingHistory = current.versionHistory?.length
          ? cloneValue(current.versionHistory)
          : [{
              versionNumber: currentVersion,
              status: currentStatus,
              createdAt: current.createdAt,
              snapshot: missionDraftFrom(current),
            }];
        const versionNumber = currentVersion + 1;
        const createdAt = deterministicTimestamp(
          state.characters.length + state.missions.length + versionNumber,
        );
        const snapshot = cloneValue({ ...draft, publishStatus: nextStatus });
        const updated: Mission = {
          ...current,
          ...snapshot,
          versionNumber,
          versionHistory: [
            ...existingHistory,
            { versionNumber, status: nextStatus, createdAt, snapshot },
          ],
        };
        set({ missions: state.missions.map((item) => item.id === id ? updated : item) });
        return updated;
      },
      toggleFavorite: (characterId) =>
        set((state) => ({
          favoriteCharacterIds: state.favoriteCharacterIds.includes(characterId)
            ? state.favoriteCharacterIds.filter((id) => id !== characterId)
            : [...state.favoriteCharacterIds, characterId],
        })),
      touchHistory: (history) =>
        set((state) => ({
          histories: [
            {
              ...history,
              lastActiveAt: nextHistoryTimestamp(state.histories),
            },
            ...state.histories.filter((item) => item.id !== history.id),
          ],
        })),
      completeMission: (missionId) => {
        if (get().completedMissionIds.includes(missionId)) return;
        set((state) => ({
          completedMissionIds: [...state.completedMissionIds, missionId],
          unlockedRewardIds: [...state.unlockedRewardIds, missionId],
          xp: state.xp + 120,
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      migrate: (persisted, version) => {
        if (version !== 1) throw new Error("지원하지 않는 브라우저 기록 버전이에요.");
        return migrateMockOwnership(persisted, seedCharacters.map((item) => item.id), seedMissions.map((item) => item.id)) as unknown as MockLearningData;
      },
      onRehydrateStorage: () => (_state, error) => { ownershipLoadError = error; },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        characters: state.characters,
        missions: state.missions,
        ownedCharacterIds: state.ownedCharacterIds,
        ownedMissionIds: state.ownedMissionIds,
        favoriteCharacterIds: state.favoriteCharacterIds,
        completedMissionIds: state.completedMissionIds,
        unlockedRewardIds: state.unlockedRewardIds,
        histories: state.histories,
        streak: state.streak,
        xp: state.xp,
        weeklyMinutes: state.weeklyMinutes,
      }),
    },
  ),
);

function snapshot(state: MockLearningStore): LearningSnapshot {
  return {
    favoriteCharacterIds: [...state.favoriteCharacterIds],
    completedMissionIds: [...state.completedMissionIds],
    unlockedRewardIds: [...state.unlockedRewardIds],
    histories: [...state.histories],
    streak: state.streak,
    xp: state.xp,
    weeklyMinutes: state.weeklyMinutes,
  };
}

export function readMockOwnedContent() {
  assertOwnershipLoaded();
  const state = mockLearningStore.getState();
  return {
    characters: state.characters.filter((item) => state.ownedCharacterIds.includes(item.id)),
    missions: state.missions.filter((item) => state.ownedMissionIds.includes(item.id)),
  };
}

export const mockLearningRepository: LearningRepository = {
  async listCharacters() {
    return [...mockLearningStore.getState().characters];
  },
  async getCharacter(id) {
    return (
      mockLearningStore.getState().characters.find((item) => item.id === id) ??
      null
    );
  },
  async createCharacter(draft) {
    return mockLearningStore.getState().addCharacter(draft);
  },
  async updateCharacter(id, draft) {
    return mockLearningStore.getState().updateCharacter(id, draft);
  },
  async listMissions() {
    return [...mockLearningStore.getState().missions];
  },
  async getMission(id) {
    return mockLearningStore.getState().missions.find((item) => item.id === id) ?? null;
  },
  async createMission(draft) {
    return mockLearningStore.getState().addMission(draft);
  },
  async updateMission(id, draft) {
    return mockLearningStore.getState().updateMission(id, draft);
  },
  async getLearningSnapshot() {
    return snapshot(mockLearningStore.getState());
  },
  async toggleFavorite(characterId) {
    mockLearningStore.getState().toggleFavorite(characterId);
    return snapshot(mockLearningStore.getState());
  },
  async touchHistory(history) {
    mockLearningStore.getState().touchHistory(history);
    return snapshot(mockLearningStore.getState());
  },
  async completeMission({ missionId }: CompleteMissionInput) {
    mockLearningStore.getState().completeMission(missionId);
    return snapshot(mockLearningStore.getState());
  },
};
