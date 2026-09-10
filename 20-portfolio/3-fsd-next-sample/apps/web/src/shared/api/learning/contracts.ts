export type CharacterVisibility = "public" | "private";
export type PublishStatus = "draft" | "published" | "archived";

export type ContentVersion<TDraft> = {
  versionNumber: number;
  status: PublishStatus;
  createdAt: string;
  snapshot: TDraft;
};

export type Character = {
  metadataSource?: "published-version" | "current-resource";
  id: string;
  name: string;
  role: string;
  tagline: string;
  description: string;
  personality: string[];
  personaGoal: string;
  learningGoal: string;
  speakingStyle: string;
  relationship?: string;
  teachingStyle?: string;
  prohibitedInstructions?: string[];
  accent: string;
  level: "입문" | "초급" | "중급";
  topics: string[];
  palette: [string, string];
  emoji: string;
  imageUrl?: string;
  visibility: CharacterVisibility;
  publishStatus?: PublishStatus;
  versionNumber?: number;
  versionHistory?: ContentVersion<CharacterDraft>[];
  creator: string;
  learnerCount: number;
  rating: number;
  createdAt: string;
};

export type CharacterDraft = Omit<
  Character,
  | "id"
  | "creator"
  | "learnerCount"
  | "rating"
  | "createdAt"
  | "versionNumber"
  | "versionHistory"
  | "metadataSource"
>;

export type MissionDifficulty = "입문" | "초급" | "중급";

export type MissionObjective = {
  id: string;
  label: string;
  hint: string;
};

export type MissionStep = {
  id: string;
  label: string;
  hint: string;
  required: boolean;
  successCriteria: string[];
};

export type ExampleDialogueTurn = {
  role: "learner" | "character";
  text: string;
};

export type Mission = {
  metadataSource?: "published-version" | "current-resource";
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  location: string;
  difficulty: MissionDifficulty;
  durationMinutes: number;
  learnerRole?: string;
  characterRole?: string;
  objectives: MissionObjective[];
  steps?: MissionStep[];
  keyPhrases: { english: string; korean: string }[];
  successThreshold?: number;
  prerequisites?: string[];
  exampleDialogue?: ExampleDialogueTurn[];
  rewardTitle: string;
  rewardPalette: [string, string];
  rewardEmoji: string;
  rewardImageUrl?: string;
  recommendedCharacterId: string;
  publishStatus?: PublishStatus;
  versionNumber?: number;
  versionHistory?: ContentVersion<MissionDraft>[];
  learnerCount: number;
  createdAt: string;
};

export type MissionDraft = Omit<
  Mission,
  "id" | "learnerCount" | "createdAt" | "versionNumber" | "versionHistory" | "metadataSource"
>;

export type LearningHistory = {
  id: string;
  conversationId?: string;
  characterId: string;
  missionId?: string;
  title: string;
  preview: string;
  lastActiveAt: string;
  turnCount: number;
};

export type LearningHistoryDraft = Omit<LearningHistory, "lastActiveAt">;

export type CompleteMissionInput = {
  missionId: string;
  missionRunId?: string;
  evaluationId?: string;
  rewardId?: string;
};

export type LearningSnapshot = {
  favoriteCharacterIds: string[];
  completedMissionIds: string[];
  unlockedRewardIds: string[];
  histories: LearningHistory[];
  streak: number;
  xp: number;
  weeklyMinutes: number;
};

export interface LearningRepository {
  listCharacters(): Promise<Character[]>;
  getCharacter(id: string): Promise<Character | null>;
  createCharacter(draft: CharacterDraft): Promise<Character>;
  updateCharacter?(id: string, draft: CharacterDraft): Promise<Character>;
  listMissions(): Promise<Mission[]>;
  getMission(id: string): Promise<Mission | null>;
  createMission(draft: MissionDraft): Promise<Mission>;
  updateMission?(id: string, draft: MissionDraft): Promise<Mission>;
  getLearningSnapshot(): Promise<LearningSnapshot>;
  toggleFavorite(characterId: string): Promise<LearningSnapshot>;
  touchHistory(history: LearningHistoryDraft): Promise<LearningSnapshot>;
  completeMission(input: CompleteMissionInput): Promise<LearningSnapshot>;
}
