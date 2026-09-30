type CharacterCandidate = { id: string; topics: readonly string[]; learnerCount: number; visibility: string; publishStatus?: string };
type MissionCandidate = { id: string; difficulty: string; publishStatus?: string };
const byId = (left: { id: string }, right: { id: string }) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;

// Recommendations use stated interests only; no inferred traits or AI ranking.
export function recommendHomeCharacters<T extends CharacterCandidate>(characters: readonly T[], interests: readonly string[]) {
  const selectedInterests = new Set(interests);
  return characters.filter(character => character.visibility === "public" && character.publishStatus === "published").map(character => ({
    character,
    matchedInterests: [...new Set(character.topics.filter(topic => selectedInterests.has(topic)))].sort(),
  })).sort((left, right) => right.matchedInterests.length - left.matchedInterests.length || byId(left.character, right.character)).slice(0, 3);
}

export function popularHomeCharacters<T extends CharacterCandidate>(characters: readonly T[]) {
  return characters.filter(character => character.visibility === "public" && character.publishStatus === "published").sort((left, right) => right.learnerCount - left.learnerCount || byId(left, right)).slice(0, 3);
}

export function beginnerHomeMissions<T extends MissionCandidate>(missions: readonly T[]) {
  return missions.filter(mission => mission.publishStatus === "published" && (mission.difficulty === "입문" || mission.difficulty === "초급")).sort(byId).slice(0, 4);
}
