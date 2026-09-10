import { z } from "zod";

const characterMetadata = z.object({
  schemaVersion: z.literal(1), name: z.string().min(1).max(80),
  tagline: z.string().max(160), description: z.string(), tags: z.array(z.string().min(1).max(40)),
}).strict();
const missionMetadata = z.object({
  schemaVersion: z.literal(1), title: z.string().min(1).max(120), summary: z.string().max(500),
  scenario_category: z.string(), difficulty: z.enum(["pre-A1", "A1", "A2", "B1", "B2", "C1", "C2"]),
  estimated_minutes: z.number().int().min(1).max(180),
}).strict();

export function restoreCharacterDisplayMetadata(
  current: { name: string; tagline: string; description: string },
  tags: readonly string[],
  stored: unknown,
) {
  if (stored == null) return { ...current, tags: [...tags], metadataSource: "current-resource" as const };
  const parsed = characterMetadata.parse(stored);
  return { name: parsed.name, tagline: parsed.tagline, description: parsed.description,
    tags: parsed.tags, metadataSource: "published-version" as const };
}

export function restoreMissionDisplayMetadata(
  current: { title: string; summary: string; scenario_category: string; difficulty: string; estimated_minutes: number },
  stored: unknown,
) {
  if (stored == null) return { ...current, metadataSource: "current-resource" as const };
  const parsed = missionMetadata.parse(stored);
  return { title: parsed.title, summary: parsed.summary, scenario_category: parsed.scenario_category,
    difficulty: parsed.difficulty, estimated_minutes: parsed.estimated_minutes, metadataSource: "published-version" as const };
}
