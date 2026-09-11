import type { Character, Mission } from "@/shared/api/learning/contracts";
import type { LearningPreferences } from "@/entities/learner";

const difficultyRank = { 입문: 0, 초급: 1, 중급: 2 } as const;

export function selectNextMission({ missions, characters, currentId, completedIds, level }: {
  missions: readonly Mission[]; characters: readonly Character[]; currentId: string;
  completedIds: readonly string[]; level: LearningPreferences["learnerLevel"];
}): Mission | undefined {
  const maximum = level === "PRE_A1" || level === "A1" ? 0 : level === "A2" ? 1 : 2;
  const completed = new Set(completedIds);
  const availableCharacters = new Set(characters.filter(item => item.publishStatus === "published" && item.visibility === "public").map(item => item.id));
  return missions.filter(item => item.publishStatus === "published" && item.id !== currentId
    && !completed.has(item.id) && difficultyRank[item.difficulty] <= maximum
    && availableCharacters.has(item.recommendedCharacterId)
    && (item.prerequisites ?? []).every(id => completed.has(id)))
    .sort((left, right) => Number((right.prerequisites ?? []).includes(currentId)) - Number((left.prerequisites ?? []).includes(currentId))
      || difficultyRank[right.difficulty] - difficultyRank[left.difficulty]
      || left.id.localeCompare(right.id))[0];
}
