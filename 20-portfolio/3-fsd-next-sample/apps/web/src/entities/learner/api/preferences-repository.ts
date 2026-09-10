import { defaultPreferences, learningPreferencesSchema, migrateLegacyPreferences, preferenceRecordSchema, type LearningPreferences, type PreferenceRecord } from "../model/preferences";

export const preferenceStorageKey = "lingua-profile-preferences-v2";
export const legacyPreferenceStorageKey = "lingua-profile-preferences-v1";

export function createLocalPreferences(storage: Pick<Storage, "getItem" | "setItem">) {
  function read(): PreferenceRecord {
    const saved = storage.getItem(preferenceStorageKey);
    if (saved !== null) {
      const record = preferenceRecordSchema.parse(JSON.parse(saved));
      if (record.ownerId !== "browser") throw new Error("브라우저 설정의 범위가 일치하지 않아요.");
      return record;
    }
    const legacy = storage.getItem(legacyPreferenceStorageKey);
    return { ownerId: "browser", revision: 0, settings: legacy === null ? structuredClone(defaultPreferences) : migrateLegacyPreferences(JSON.parse(legacy)) };
  }
  return {
    read,
    save(previous: PreferenceRecord, input: LearningPreferences): PreferenceRecord {
      const current = read();
      if (previous.ownerId !== current.ownerId || previous.revision !== current.revision) throw new Error("다른 창에서 설정이 바뀌었어요. 최신 설정을 불러온 뒤 다시 편집해 주세요.");
      const next = { ownerId: "browser", revision: current.revision + 1, settings: learningPreferencesSchema.parse(input) };
      storage.setItem(preferenceStorageKey, JSON.stringify(next));
      return next;
    },
  };
}

export function remotePreferencesEnabled() {
  return process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock" && process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase";
}

export function createHttpPreferences(fetcher: typeof fetch = fetch) {
  async function request(init?: RequestInit): Promise<PreferenceRecord> {
    const response = await fetcher("/api/me/preferences", { ...init, cache: "no-store", headers: { "Content-Type": "application/json" } });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "학습 설정을 불러오거나 저장하지 못했어요.");
    return preferenceRecordSchema.parse(body.preferences);
  }
  return {
    read: () => request(),
    save: (previous: PreferenceRecord, settings: LearningPreferences) => request({ method: "PATCH", body: JSON.stringify({ expectedOwnerId: previous.ownerId, expectedRevision: previous.revision, settings: learningPreferencesSchema.parse(settings) }) }),
  };
}
