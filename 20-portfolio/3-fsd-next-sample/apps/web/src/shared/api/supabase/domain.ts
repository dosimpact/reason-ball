import { readMissionDifficulty as missionDifficulty } from "./mission-difficulty";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  Character,
  CharacterDraft,
  LearningHistory,
  LearningHistoryDraft,
  Mission,
  MissionDraft,
} from "@/shared/api/learning/contracts";

import { assertDatabaseSuccess, createPrivilegedClient, SupabaseHttpError } from "./http";
import { readMissionObjectives, readMissionPrerequisites } from "./mission-version-fields";
import { restoreCharacterDisplayMetadata, restoreMissionDisplayMetadata } from "./version-display-metadata";
import { missionPhraseLengthIssues } from "./mission-level-validation";

const paletteOptions: [string, string][] = [
  ["#7887c7", "#d8dcf0"],
  ["#b87352", "#f2d5c4"],
  ["#5f8f7b", "#cce6dc"],
  ["#9b6d9b", "#ead7ea"],
  ["#a88643", "#f1dfb7"],
];

const resourceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const uuidSchema = z.uuid();
export const resourceIdSchema = z.union([uuidSchema, resourceSlugSchema]);

const paletteSchema = z.tuple([
  z.string().regex(/^#[0-9a-f]{6}$/i),
  z.string().regex(/^#[0-9a-f]{6}$/i),
]);

export const characterDraftSchema: z.ZodType<CharacterDraft> = z
  .object({
    name: z.string().trim().min(1).max(80),
    role: z.string().trim().min(1).max(160),
    tagline: z.string().trim().max(160),
    description: z.string().trim().max(8_000),
    personality: z.array(z.string().trim().min(1).max(100)).max(20),
    personaGoal: z.string().trim().min(1).max(2_000),
    learningGoal: z.string().trim().min(1).max(2_000),
    speakingStyle: z.string().trim().min(1).max(1_000),
    relationship: z.string().trim().max(500).optional(),
    teachingStyle: z.string().trim().max(1_000).optional(),
    prohibitedInstructions: z
      .array(z.string().trim().min(1).max(500))
      .max(30)
      .optional(),
    accent: z.string().trim().min(1).max(80),
    level: z.enum(["입문", "초급", "중급"]),
    topics: z.array(z.string().trim().min(1).max(80)).max(30),
    palette: paletteSchema,
    emoji: z.string().trim().min(1).max(32),
    imageUrl: z.url().max(14 * 1024 * 1024).optional(),
    visibility: z.enum(["public", "private"]),
    publishStatus: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict();

const missionObjectiveSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(500),
    hint: z.string().trim().max(1_000),
  })
  .strict();

const keyPhraseSchema = z
  .object({
    english: z.string().trim().min(1).max(500),
    korean: z.string().trim().max(500),
  })
  .strict();

const missionStepSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(500),
    hint: z.string().trim().max(1_000),
    required: z.boolean(),
    successCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  })
  .strict();

const dialogueTurnSchema = z
  .object({
    role: z.enum(["learner", "character"]),
    text: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const missionDraftSchema: z.ZodType<MissionDraft> = z
  .object({
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5_000),
    category: z.string().trim().min(1).max(100),
    location: z.string().trim().min(1).max(1_000),
    difficulty: z.enum(["입문", "초급", "중급"]),
    durationMinutes: z.number().int().min(1).max(180),
    learnerRole: z.string().trim().min(1).max(500).optional(),
    characterRole: z.string().trim().min(1).max(500).optional(),
    objectives: z.array(missionObjectiveSchema).min(1).max(30),
    steps: z.array(missionStepSchema).min(1).max(30).optional(),
    keyPhrases: z.array(keyPhraseSchema).max(30),
    successThreshold: z.number().min(0).max(100).optional(),
    prerequisites: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
    exampleDialogue: z.array(dialogueTurnSchema).max(40).optional(),
    rewardTitle: z.string().trim().min(1).max(200),
    rewardPalette: paletteSchema,
    rewardEmoji: z.string().trim().min(1).max(32),
    rewardImageUrl: z.url().max(14 * 1024 * 1024).optional(),
    recommendedCharacterId: resourceIdSchema,
    publishStatus: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict()
  .superRefine((draft, context) => {
    for (const issue of missionPhraseLengthIssues(draft)) context.addIssue(issue);
  });

export const learningHistoryDraftSchema: z.ZodType<LearningHistoryDraft> = z
  .object({
    id: z.string().trim().min(1).max(200),
    characterId: resourceIdSchema,
    missionId: resourceIdSchema.optional(),
    title: z.string().trim().min(1).max(200),
    preview: z.string().trim().max(4_000),
    turnCount: z.number().int().min(0).max(1_000_000),
  })
  .strict();

export const missionCompletionSchema = z
  .object({
    evaluationId: uuidSchema,
    rewardId: uuidSchema,
  })
  .strict();

type CharacterRow = {
  id: string;
  owner_id: string | null;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  visibility: string;
  status: string;
  current_version_id: string | null;
  conversation_count: number | string;
  featured: boolean;
  created_at: string;
};

type CharacterVersionRow = {
  display_metadata: unknown;
  id: string;
  version_number: number;
  personality_summary: string;
  personality_traits: unknown;
  persona_goals: unknown;
  learning_goals: unknown;
  backstory: string;
  voice_config: unknown;
  locale: string;
};

type CharacterTagRow = {
  character_id: string;
  tag: string;
};

type PublicAssetRow = {
  character_id: string;
  character_version_id: string | null;
  access_level: string;
  storage_bucket: string;
  storage_path: string;
  alt_text: string;
  is_primary: boolean;
  sort_order: number;
};

type ProfileRow = {
  id: string;
  display_name: string;
};

type MissionRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scenario_category: string;
  difficulty: string;
  estimated_minutes: number;
  status: string;
  current_version_id: string | null;
  reward_experience_points: number;
  completion_count: number | string;
  featured: boolean;
  created_at: string;
};

type MissionVersionRow = {
  display_metadata: unknown;
  id: string;
  version_number: number;
  learning_goals: unknown;
  scenario_context: string;
  learner_role: string;
  character_role: string;
  opening_instruction: string;
  target_vocabulary: unknown;
  target_grammar: unknown;
  pass_score: number | string;
};

type MissionStepRow = {
  id: string;
  mission_version_id: string;
  step_order: number;
  title: string;
  objective: string;
  learner_goal: string;
  hints: unknown;
  success_criteria: unknown;
  is_optional: boolean;
};

type MissionCharacterRow = {
  mission_id: string;
  character_id: string;
  is_recommended: boolean;
};

type PublicMissionAssetRow = {
  mission_id: string;
  storage_bucket: string;
  storage_path: string;
  asset_type: string;
  is_primary: boolean;
};

type ResourceSnapshotRow = {
  id: string;
  current_version_id: string | null;
};

type ConversationRow = {
  id: string;
  character_id: string;
  mission_id: string | null;
  title: string;
  metadata: unknown;
  last_message_at: string | null;
  created_at: string;
};

type MessageRow = {
  conversation_id: string;
  plain_text: string;
  sequence_number: number | string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return item.trim() ? [item] : [];
    }

    const record = asRecord(item);
    const text =
      asString(record.label) ??
      asString(record.text) ??
      asString(record.goal) ??
      asString(record.name);
    return text?.trim() ? [text] : [];
  });
}

function firstString(value: unknown, fallback: string) {
  return asStringArray(value)[0] ?? fallback;
}

function stablePalette(value: string): [string, string] {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return paletteOptions[hash % paletteOptions.length];
}

function levelFromText(values: string[]): Character["level"] {
  const searchable = values.join(" ").toLowerCase();
  if (/beginner|pre-a1|\ba1\b|입문/.test(searchable)) {
    return "입문";
  }
  if (/advanced|\bb2\b|\bc1\b|\bc2\b|중급/.test(searchable)) {
    return "중급";
  }
  if (/elementary|intermediate|\ba2\b|\bb1\b|초급/.test(searchable)) {
    return "초급";
  }
  return "입문";
}

function accentFromLocale(locale: string) {
  const normalized = locale.toLowerCase();
  if (normalized.includes("gb")) return "British English";
  if (normalized.includes("au")) return "Australian English";
  if (normalized.includes("ca")) return "Canadian English";
  return "American English";
}

function emojiFromTags(tags: string[]) {
  const normalized = tags.join(" ").toLowerCase();
  if (/hotel|travel/.test(normalized)) return "🧭";
  if (/coffee|cafe|barista/.test(normalized)) return "☕";
  if (/food|restaurant/.test(normalized)) return "🍽️";
  if (/work|business/.test(normalized)) return "💼";
  return "💬";
}


function missionEmoji(category: string) {
  const normalized = category.toLowerCase();
  if (/hotel|travel/.test(normalized)) return "🧳";
  if (/coffee|cafe/.test(normalized)) return "☕";
  if (/food|restaurant/.test(normalized)) return "🍽️";
  if (/shopping/.test(normalized)) return "🛍️";
  return "🎁";
}

function keyPhrasesFromJson(vocabulary: unknown, grammar: unknown) {
  const vocabularyPhrases = Array.isArray(vocabulary)
    ? vocabulary.flatMap((item) => {
        const record = asRecord(item);
        const english =
          asString(record.english) ??
          asString(record.term) ??
          asString(record.phrase);
        if (!english?.trim()) return [];
        return [
          {
            english,
            korean:
              asString(record.korean) ??
              asString(record.meaning) ??
              "핵심 어휘",
          },
        ];
      })
    : [];

  const grammarPhrases = Array.isArray(grammar)
    ? grammar.flatMap((item) => {
        if (typeof item === "string") {
          return item.trim()
            ? [{ english: item, korean: "핵심 문장 패턴" }]
            : [];
        }
        const record = asRecord(item);
        const english =
          asString(record.english) ??
          asString(record.pattern) ??
          asString(record.example);
        if (!english?.trim()) return [];
        return [
          {
            english,
            korean:
              asString(record.korean) ??
              asString(record.meaning) ??
              "핵심 문장 패턴",
          },
        ];
      })
    : [];

  return [...vocabularyPhrases, ...grammarPhrases].slice(0, 12);
}

function publicAssetUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
) {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function characterAssetUrl(client: SupabaseClient, asset: PublicAssetRow) {
  if (asset.access_level === "public") {
    return publicAssetUrl(client, asset.storage_bucket, asset.storage_path);
  }
  // Use the request client's Storage policy; signing must not bypass ownership.
  const result = await client.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 300);
  if (result.error || !result.data) {
    throw new SupabaseHttpError(502, "DATA_SERVICE_ERROR", "The character image could not be loaded.", true);
  }
  return result.data!.signedUrl;
}

function uniqueStrings(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const itemKey = key(item);
    groups.set(itemKey, [...(groups.get(itemKey) ?? []), item]);
  }
  return groups;
}

async function hydrateCharacters(
  client: SupabaseClient,
  rows: CharacterRow[],
): Promise<Character[]> {
  if (rows.length === 0) return [];

  const characterIds = rows.map((row) => row.id);
  const versionIds = uniqueStrings(rows.map((row) => row.current_version_id));
  const ownerIds = uniqueStrings(rows.map((row) => row.owner_id));

  const [versionsResult, tagsResult, assetsResult, profilesResult] =
    await Promise.all([
      versionIds.length > 0
        ? client
            .from("character_versions")
            .select(
              "id, version_number, personality_summary, personality_traits, persona_goals, learning_goals, backstory, voice_config, locale, display_metadata",
            )
            .in("id", versionIds)
        : Promise.resolve({ data: [], error: null }),
      client
        .from("character_tags")
        .select("character_id, tag")
        .in("character_id", characterIds),
      client
        .from("character_assets")
        .select(
          "character_id, character_version_id, access_level, storage_bucket, storage_path, alt_text, is_primary, sort_order",
        )
        .in("character_id", characterIds)
        .eq("asset_type", "avatar")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
      ownerIds.length > 0
        ? client
            .from("profiles")
            .select("id, display_name")
            .in("id", ownerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  assertDatabaseSuccess(versionsResult.error, "character_versions.select");
  assertDatabaseSuccess(tagsResult.error, "character_tags.select");
  assertDatabaseSuccess(assetsResult.error, "character_assets.select");
  assertDatabaseSuccess(profilesResult.error, "profiles.select");

  const versions = (versionsResult.data ?? []) as CharacterVersionRow[];
  const tags = (tagsResult.data ?? []) as CharacterTagRow[];
  const assets = (assetsResult.data ?? []) as PublicAssetRow[];
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const tagsByCharacter = groupBy(tags, (tag) => tag.character_id);
  const assetsByCharacter = groupBy(assets, (asset) => asset.character_id);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return Promise.all(rows.map(async (currentRow) => {
    const version = currentRow.current_version_id
      ? versionById.get(currentRow.current_version_id)
      : undefined;
    const currentTags = (tagsByCharacter.get(currentRow.id) ?? []).map(
      (tag) => tag.tag,
    );
    const display = restoreCharacterDisplayMetadata(currentRow, currentTags, version?.display_metadata);
    const row = { ...currentRow, ...display };
    const characterTags = display.tags;
    const compatibleAssets = (assetsByCharacter.get(row.id) ?? []).filter(
      (asset) =>
        asset.access_level ===
        (row.visibility === "public" ? "public" : "owner"),
    );
    const primaryAsset =
      compatibleAssets.find(
        (asset) => asset.character_version_id === row.current_version_id,
      ) ?? compatibleAssets[0];
    const voice = asRecord(version?.voice_config);
    const goals = asStringArray(version?.learning_goals);

    return {
      id: row.id,
      name: row.name,
      metadataSource: display.metadataSource,
      role:
        asString(voice.role) ??
        firstString(asRecord(version?.voice_config).roles, "영어 회화 파트너"),
      tagline: row.tagline,
      description: row.description || version?.backstory || "",
      personality:
        asStringArray(version?.personality_traits).length > 0
          ? asStringArray(version?.personality_traits)
          : version?.personality_summary
            ? [version.personality_summary]
            : [],
      personaGoal: firstString(
        version?.persona_goals,
        "학습자가 자신 있게 영어로 말하도록 돕기",
      ),
      learningGoal: goals[0] ?? "실생활 영어 회화 연습",
      speakingStyle:
        asString(voice.style) ??
        version?.personality_summary ??
        "Warm and encouraging",
      ...(asString(voice.relationship)
        ? { relationship: asString(voice.relationship) }
        : {}),
      ...(asString(voice.teachingStyle)
        ? { teachingStyle: asString(voice.teachingStyle) }
        : {}),
      accent: accentFromLocale(version?.locale ?? "en-US"),
      level: levelFromText([...characterTags, ...goals]),
      topics: characterTags,
      palette: stablePalette(row.id),
      emoji: emojiFromTags(characterTags),
      ...(primaryAsset
        ? {
            imageUrl: await characterAssetUrl(client, primaryAsset),
          }
        : {}),
      visibility: row.visibility === "private" ? "private" : "public",
      publishStatus:
        row.status === "published"
          ? "published"
          : row.status === "archived"
            ? "archived"
            : "draft",
      ...(version?.version_number
        ? { versionNumber: version.version_number }
        : {}),
      creator: row.owner_id
        ? (profileById.get(row.owner_id)?.display_name ?? "크리에이터")
        : "Lingo Studio",
      learnerCount: asNumber(row.conversation_count),
      rating: 5,
      createdAt: row.created_at,
    } satisfies Character;
  }));
}

export async function listCharacters(client: SupabaseClient) {
  const result = await client
    .from("characters")
    .select(
      "id, owner_id, slug, name, tagline, description, visibility, status, current_version_id, conversation_count, featured, created_at",
    )
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  assertDatabaseSuccess(result.error, "characters.select");
  return hydrateCharacters(client, (result.data ?? []) as CharacterRow[]);
}

export async function getCharacter(client: SupabaseClient, identifier: string, pinnedVersionId?: string) {
  const column = uuidSchema.safeParse(identifier).success ? "id" : "slug";
  const result = await client
    .from("characters")
    .select(
      "id, owner_id, slug, name, tagline, description, visibility, status, current_version_id, conversation_count, featured, created_at",
    )
    .eq(column, identifier)
    .limit(1);

  assertDatabaseSuccess(result.error, "characters.select_one");
  if (pinnedVersionId && result.data?.[0]) {
    const version = await client.from("character_versions").select("id")
      .eq("id", pinnedVersionId).eq("character_id", result.data[0].id).not("published_at", "is", null).limit(1);
    assertDatabaseSuccess(version.error, "character_versions.pinned");
    if (!version.data?.length) throw new SupabaseHttpError(409, "CHAT_CONTEXT_UNAVAILABLE", "The saved character version is unavailable.");
    result.data[0].current_version_id = pinnedVersionId;
  }
  const items = await hydrateCharacters(
    client,
    (result.data ?? []) as CharacterRow[],
  );
  return items[0] ?? null;
}

async function hydrateMissions(
  client: SupabaseClient,
  rows: MissionRow[],
): Promise<Mission[]> {
  if (rows.length === 0) return [];

  const missionIds = rows.map((row) => row.id);
  const versionIds = uniqueStrings(rows.map((row) => row.current_version_id));
  const [versionsResult, stepsResult, charactersResult, assetsResult, conditionsResult] =
    await Promise.all([
      versionIds.length > 0
        ? client
            .from("mission_versions")
            .select(
              "id, version_number, learning_goals, scenario_context, learner_role, character_role, opening_instruction, target_vocabulary, target_grammar, pass_score, display_metadata",
            )
            .in("id", versionIds)
        : Promise.resolve({ data: [], error: null }),
      versionIds.length > 0
        ? client
            .from("mission_steps")
            .select(
              "id, mission_version_id, step_order, title, objective, learner_goal, hints, success_criteria, is_optional",
            )
            .in("mission_version_id", versionIds)
            .order("step_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      client
        .from("mission_characters")
        .select("mission_id, character_id, is_recommended")
        .in("mission_id", missionIds)
        .order("is_recommended", { ascending: false }),
      client
        .from("mission_assets")
        .select(
          "mission_id, storage_bucket, storage_path, asset_type, is_primary",
        )
        .in("mission_id", missionIds)
        .eq("access_level", "public")
        .order("is_primary", { ascending: false }),
      // IDs come only from RLS-visible missions. Do not return private settings.
      versionIds.length > 0
        ? createPrivilegedClient()
            .from("mission_version_instructions")
            .select("mission_version_id, evaluator_config")
            .in("mission_version_id", versionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  assertDatabaseSuccess(versionsResult.error, "mission_versions.select");
  assertDatabaseSuccess(stepsResult.error, "mission_steps.select");
  assertDatabaseSuccess(charactersResult.error, "mission_characters.select");
  assertDatabaseSuccess(assetsResult.error, "mission_assets.select");
  assertDatabaseSuccess(conditionsResult.error, "mission_version_instructions.conditions");
  const objectiveConfigByVersion = new Map(
    ((conditionsResult.data ?? []) as Array<{ mission_version_id: string; evaluator_config: unknown }>)
      .map((row) => [row.mission_version_id, row.evaluator_config]),
  );
  const conditionsByVersion = new Map(
    ((conditionsResult.data ?? []) as Array<{ mission_version_id: string; evaluator_config: unknown }>)
      .map((row) => [row.mission_version_id, readMissionPrerequisites(row.evaluator_config)]),
  );

  const versions = (versionsResult.data ?? []) as MissionVersionRow[];
  for (const version of versions) {
    if (!conditionsByVersion.has(version.id)) {
      throw new SupabaseHttpError(502, "MISSION_CONDITIONS_UNAVAILABLE", "The mission start conditions could not be loaded.", true);
    }
  }
  const steps = (stepsResult.data ?? []) as MissionStepRow[];
  const characters = (charactersResult.data ?? []) as MissionCharacterRow[];
  const assets = (assetsResult.data ?? []) as PublicMissionAssetRow[];
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const stepsByVersion = groupBy(steps, (step) => step.mission_version_id);
  const charactersByMission = groupBy(
    characters,
    (character) => character.mission_id,
  );
  const assetsByMission = groupBy(assets, (asset) => asset.mission_id);

  return rows.map((currentRow) => {
    const version = currentRow.current_version_id
      ? versionById.get(currentRow.current_version_id)
      : undefined;
    const display = restoreMissionDisplayMetadata(currentRow, version?.display_metadata);
    const row = { ...currentRow, ...display };
    const missionSteps = row.current_version_id
      ? (stepsByVersion.get(row.current_version_id) ?? [])
      : [];
    const recommendedCharacter = charactersByMission.get(row.id)?.[0];
    const rewardAsset = assetsByMission
      .get(row.id)
      ?.find((asset) => asset.asset_type === "badge");

    return {
      id: row.id,
      title: row.title,
      metadataSource: display.metadataSource,
      subtitle: version?.opening_instruction ?? row.summary,
      description: row.summary || version?.scenario_context || "",
      category: ({ travel: "여행", daily: "일상", everyday: "일상", relationships: "관계", relationship: "관계", work: "업무", business: "업무" } as Record<string, string>)[row.scenario_category] ?? row.scenario_category,
      location: version?.scenario_context ?? row.scenario_category,
      difficulty: missionDifficulty(row.difficulty),
      durationMinutes: row.estimated_minutes,
      ...(version?.learner_role ? { learnerRole: version.learner_role } : {}),
      ...(version?.character_role
        ? { characterRole: version.character_role }
        : {}),
      objectives: readMissionObjectives(
        version ? objectiveConfigByVersion.get(version.id) : undefined,
        version?.learning_goals,
        missionSteps
        .filter((step) => !step.is_optional)
        .map((step) => ({
          id: step.id,
          label: step.objective || step.learner_goal || step.title,
          hint: firstString(step.hints, step.learner_goal),
        }))),
      steps: missionSteps.map((step) => ({
        id: step.id,
        label: step.objective || step.learner_goal || step.title,
        hint: firstString(step.hints, step.learner_goal),
        required: !step.is_optional,
        successCriteria: asStringArray(step.success_criteria),
      })),
      keyPhrases: keyPhrasesFromJson(
        version?.target_vocabulary,
        version?.target_grammar,
      ),
      successThreshold: asNumber(version?.pass_score, 70),
      prerequisites: version ? conditionsByVersion.get(version.id) ?? [] : [],
      rewardTitle: `${row.title} 완료 장면 · ${row.reward_experience_points} XP`,
      rewardPalette: stablePalette(row.id),
      rewardEmoji: missionEmoji(row.scenario_category),
      ...(rewardAsset
        ? {
            rewardImageUrl: publicAssetUrl(
              client,
              rewardAsset.storage_bucket,
              rewardAsset.storage_path,
            ),
          }
        : {}),
      recommendedCharacterId: recommendedCharacter?.character_id ?? "",
      publishStatus:
        row.status === "published"
          ? "published"
          : row.status === "archived"
            ? "archived"
            : "draft",
      ...(version?.version_number
        ? { versionNumber: version.version_number }
        : {}),
      learnerCount: asNumber(row.completion_count),
      createdAt: row.created_at,
    } satisfies Mission;
  });
}

export async function listMissions(client: SupabaseClient) {
  const result = await client
    .from("missions")
    .select(
      "id, slug, title, summary, scenario_category, difficulty, estimated_minutes, status, current_version_id, reward_experience_points, completion_count, featured, created_at",
    )
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  assertDatabaseSuccess(result.error, "missions.select");
  return hydrateMissions(client, (result.data ?? []) as MissionRow[]);
}

export async function getMission(client: SupabaseClient, identifier: string, pinnedVersionId?: string) {
  const column = uuidSchema.safeParse(identifier).success ? "id" : "slug";
  const result = await client
    .from("missions")
    .select(
      "id, slug, title, summary, scenario_category, difficulty, estimated_minutes, status, current_version_id, reward_experience_points, completion_count, featured, created_at",
    )
    .eq(column, identifier)
    .limit(1);

  assertDatabaseSuccess(result.error, "missions.select_one");
  if (pinnedVersionId && result.data?.[0]) {
    const version = await client.from("mission_versions").select("id")
      .eq("id", pinnedVersionId).eq("mission_id", result.data[0].id).not("published_at", "is", null).limit(1);
    assertDatabaseSuccess(version.error, "mission_versions.pinned");
    if (!version.data?.length) throw new SupabaseHttpError(409, "CHAT_CONTEXT_UNAVAILABLE", "The saved mission version is unavailable.");
    result.data[0].current_version_id = pinnedVersionId;
  }
  const items = await hydrateMissions(
    client,
    (result.data ?? []) as MissionRow[],
  );
  return items[0] ?? null;
}

export async function resolveResourceSnapshot(
  client: SupabaseClient,
  table: "characters" | "missions",
  identifier: string,
) {
  const row = await resolveResource(client, table, identifier);
  if (!row.current_version_id) {
    throw new SupabaseHttpError(
      409,
      "RESOURCE_VERSION_REQUIRED",
      "The selected resource does not have an active version.",
    );
  }

  return { id: row.id, versionId: row.current_version_id };
}

export async function resolveResource(
  client: SupabaseClient,
  table: "characters" | "missions",
  identifier: string,
) {
  const column = uuidSchema.safeParse(identifier).success ? "id" : "slug";
  const result = await client
    .from(table)
    .select("id, current_version_id")
    .eq(column, identifier)
    .limit(1);

  assertDatabaseSuccess(result.error, `${table}.resolve_snapshot`);
  const row = ((result.data ?? []) as ResourceSnapshotRow[])[0];
  if (!row) {
    throw new SupabaseHttpError(
      404,
      table === "characters" ? "CHARACTER_NOT_FOUND" : "MISSION_NOT_FOUND",
      table === "characters"
        ? "The character could not be found."
        : "The mission could not be found.",
    );
  }
  return row;
}

export function historyFromConversation(
  row: ConversationRow,
  latestMessage?: MessageRow,
  messageCount?: number,
): LearningHistory {
  const metadata = asRecord(row.metadata);
  return {
    id: asString(metadata.clientHistoryId) ?? row.id,
    conversationId: row.id,
    characterId: row.character_id,
    ...(row.mission_id ? { missionId: row.mission_id } : {}),
    title: row.title,
    preview:
      latestMessage?.plain_text ?? asString(metadata.historyPreview) ?? "",
    lastActiveAt: row.last_message_at ?? row.created_at,
    turnCount:
      messageCount ?? asNumber(metadata.reportedTurnCount, 0),
  };
}

export async function touchLearningHistory(
  client: SupabaseClient,
  ownerId: string,
  draft: LearningHistoryDraft,
) {
  let existing: ConversationRow | undefined;

  if (uuidSchema.safeParse(draft.id).success) {
    const byIdResult = await client
      .from("conversations")
      .select(
        "id, character_id, mission_id, title, metadata, last_message_at, created_at",
      )
      .eq("owner_id", ownerId)
      .eq("id", draft.id)
      .limit(1);
    assertDatabaseSuccess(byIdResult.error, "conversations.find_by_id");
    existing = ((byIdResult.data ?? []) as ConversationRow[])[0];
  }

  if (!existing) {
    const byClientIdResult = await client
      .from("conversations")
      .select(
        "id, character_id, mission_id, title, metadata, last_message_at, created_at",
      )
      .eq("owner_id", ownerId)
      .contains("metadata", { clientHistoryId: draft.id })
      .limit(1);
    assertDatabaseSuccess(
      byClientIdResult.error,
      "conversations.find_by_client_history_id",
    );
    existing = ((byClientIdResult.data ?? []) as ConversationRow[])[0];
  }

  const now = new Date().toISOString();
  if (existing) {
    const metadata = {
      ...asRecord(existing.metadata),
      clientHistoryId: draft.id,
      historyPreview: draft.preview,
      reportedTurnCount: draft.turnCount,
    };
    const updateResult = await client
      .from("conversations")
      .update({
        title: draft.title,
        metadata,
        last_message_at: now,
      })
      .eq("owner_id", ownerId)
      .eq("id", existing.id)
      .select(
        "id, character_id, mission_id, title, metadata, last_message_at, created_at",
      )
      .limit(1);
    assertDatabaseSuccess(updateResult.error, "conversations.touch");
    const updated = ((updateResult.data ?? []) as ConversationRow[])[0];
    if (!updated) {
      throw new SupabaseHttpError(
        409,
        "HISTORY_UPDATE_CONFLICT",
        "The learning history could not be updated.",
        true,
      );
    }
    return historyFromConversation(updated);
  }

  const character = await resolveResourceSnapshot(
    client,
    "characters",
    draft.characterId,
  );
  const mission = draft.missionId
    ? await resolveResourceSnapshot(client, "missions", draft.missionId)
    : undefined;
  const insertResult = await client
    .from("conversations")
    .insert({
      owner_id: ownerId,
      character_id: character.id,
      character_version_id: character.versionId,
      mission_id: mission?.id ?? null,
      mission_version_id: mission?.versionId ?? null,
      title: draft.title,
      model_id:
        process.env.AI_CHAT_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "gpt-6-astra",
      metadata: {
        clientHistoryId: draft.id,
        historyPreview: draft.preview,
        reportedTurnCount: draft.turnCount,
      },
      last_message_at: now,
    })
    .select(
      "id, character_id, mission_id, title, metadata, last_message_at, created_at",
    )
    .limit(1);
  assertDatabaseSuccess(insertResult.error, "conversations.insert");
  const inserted = ((insertResult.data ?? []) as ConversationRow[])[0];
  if (!inserted) {
    throw new SupabaseHttpError(
      502,
      "DATA_SERVICE_ERROR",
      "The learning history could not be created.",
      true,
    );
  }

  return historyFromConversation(inserted);
}

export type { ConversationRow, MessageRow };
