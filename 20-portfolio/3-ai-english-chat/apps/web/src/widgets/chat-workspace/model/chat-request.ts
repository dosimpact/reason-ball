import type { Character } from "@/entities/character";
import type { Mission } from "@/entities/mission";
import type { ChatMessage } from "@/entities/chat";
import type { LearningPreferences } from "@/entities/learner";

type ChatRequestInput = {
  messages: ChatMessage[];
  conversationId: string;
  modelId: string;
  character: Character;
  mission?: Mission;
  scenario?: string;
  mockRuntime: boolean;
  learnerPreferences?: LearningPreferences;
};

function learnerLevel(level: Character["level"]) {
  return level === "입문" ? "PRE_A1" : level === "초급" ? "A1" : "A2";
}

function mockCharacterContext(character: Character) {
  return {
    id: character.id,
    name: character.name,
    tagline: character.tagline,
    role: character.role,
    background: character.description,
    personalityTraits: character.personality,
    personaGoal: character.personaGoal,
    learningGoal: character.learningGoal,
    speakingStyle: character.speakingStyle,
    learnerLevel: learnerLevel(character.level),
    correctionMode: "gentle",
  };
}

function mockMissionContext(mission: Mission) {
  return {
    id: mission.id,
    title: mission.title,
    place: mission.location,
    situation: mission.description,
    objectives: mission.objectives.map((objective) => ({
      id: objective.id, label: objective.label, successEvidence: [objective.hint], required: true,
    })),
    level: learnerLevel(mission.difficulty),
    durationMinutes: mission.durationMinutes,
    targetExpressions: mission.keyPhrases.map((phrase) => phrase.english),
    minTurns: 2,
    maxTurns: 20,
  };
}

export function buildChatRequest(input: ChatRequestInput) {
  const base = { messages: input.messages, modelId: input.modelId };
  if (!input.mockRuntime) return { ...base, conversationId: input.conversationId };
  return {
    ...base,
    character: mockCharacterContext(input.character),
    ...(input.learnerPreferences ? { learnerPreferences: input.learnerPreferences } : {}),
    ...(input.mission ? { mission: mockMissionContext(input.mission) } : {}),
    ...(input.scenario ? { scenario: input.scenario } : {}),
  };
}
