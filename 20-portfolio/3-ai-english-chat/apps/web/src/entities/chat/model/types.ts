import type { UIMessage } from "ai";
import type { Character, Mission } from "@/shared/api/learning/contracts";

export type ChatLearningContext = {
  conversationId: string;
  character: Character;
  mission?: Mission;
  characterAliases: string[];
  missionAliases: string[];
};

export type WeatherData = {
  location: string;
  state: "approval-requested" | "denied" | "result" | "error";
  temperature?: number;
  condition?: string;
};

export type WeatherTool = {
  input: { location: string };
  output: {
    condition: string;
    location: string;
    source: string;
    temperature: number;
  } | undefined;
};

export type ChatMessage = UIMessage<
  unknown,
  { weather: WeatherData },
  { weather: WeatherTool }
>;

export type ChatVote = {
  reason?: string;
  value: "up" | "down";
};

export type ChatArtifactKind = "text" | "code" | "image" | "sheet";

export type ChatArtifactVersion = {
  content: string;
  createdAt: string;
  id: string;
  imageUrl?: string;
};

export type ChatArtifact = {
  createdAt: string;
  autosavedAt?: string;
  draft?: string;
  id: string;
  kind: ChatArtifactKind;
  title: string;
  updatedAt: string;
  versions: ChatArtifactVersion[];
};

export type ChatConversation = {
  learningContext?: { character: Character; mission?: Mission };
  artifacts: ChatArtifact[];
  characterId: string;
  characterName: string;
  createdAt: string;
  draft: string;
  id: string;
  messages: ChatMessage[];
  missionId?: string;
  missionRunId?: string;
  missionTitle?: string;
  modelId: string;
  pendingRequest?: {
    assistantMessageId?: string;
    startedAt: string;
    userMessageId: string;
  };
  routeKey: string;
  shareToken?: string;
  theme: "light" | "focus";
  title: string;
  updatedAt: string;
  votes: Record<string, ChatVote>;
};

export type CreateConversationInput = Pick<
  ChatConversation,
  "characterId" | "characterName" | "messages" | "missionId" | "missionTitle" | "routeKey" | "title" | "learningContext"
>;
