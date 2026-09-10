import { z } from "zod";

const legacySchema = z.object({
  characters: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
  missions: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
}).passthrough();

// The old demo store contains bundled seeds and browser-created additions. This
// migration establishes browser provenance only, never remote account ownership.
export function migrateMockOwnership(input: unknown, seedCharacterIds: readonly string[], seedMissionIds: readonly string[]) {
  const legacy = legacySchema.parse(input);
  return { ...legacy,
    ownedCharacterIds: [...new Set((legacy.characters ?? []).map((item) => item.id).filter((id) => !seedCharacterIds.includes(id)))],
    ownedMissionIds: [...new Set((legacy.missions ?? []).map((item) => item.id).filter((id) => !seedMissionIds.includes(id)))],
  };
}
