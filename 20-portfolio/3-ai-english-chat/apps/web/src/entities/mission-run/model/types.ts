export type MissionRunStatus =
  | "not-started"
  | "in-progress"
  | "evaluating"
  | "passed"
  | "failed"
  | "abandoned";

export type MissionStepStatus = "locked" | "active" | "completed" | "skipped";

export type MissionRunStep = {
  id: string;
  label: string;
  required: boolean;
  order: number;
  status: MissionStepStatus;
  attempts: number;
  evidenceMessageIds: string[];
  score?: number;
  feedback?: string;
};

export type EvaluationAxisKey =
  | "taskCompletion"
  | "appropriateness" // Historical evaluations only; do not relabel or recompute.
  | "comprehensibility"
  | "interaction"
  | "grammar"
  | "vocabulary";

export type EvaluationEvidence = {
  messageId?: string;
  quote: string;
  rationale: string;
};

export type EvaluationAxis = {
  key: EvaluationAxisKey;
  label: string;
  score: number;
  evidence: EvaluationEvidence[];
  feedback?: string;
};

export type MissionCorrection = {
  original: string;
  suggested: string;
  explanation: string;
};

export type MissionNewExpression = {
  english: string;
  meaning: string;
};

export type MissionHintDepth = 1 | 2 | 3;

export type MissionHint = {
  id: string;
  runId: string;
  stepId: string;
  depth: MissionHintDepth;
  result: { text: string; explanation: string };
  createdAt: string;
  contextMessageId?: string;
  contextSequenceNumber?: number;
};

export type MissionAssistanceSnapshot = {
  status: "tracked" | "unknown";
  requestCount: number;
  maxDepth: 0 | MissionHintDepth;
  steps: Array<{ stepId: string; maxDepth: MissionHintDepth; requestCount: number }>;
  capturedAt: string;
};

export type MissionEvaluation = {
  id: string;
  runId: string;
  status: "completed";
  passed: boolean;
  totalScore: number;
  stars: number;
  axes: EvaluationAxis[];
  summary: string;
  strengths: string[];
  improvements: string[];
  corrections: MissionCorrection[];
  completedStepIds: string[];
  vocabularyObserved: string[];
  newExpressions?: MissionNewExpression[];
  assistance?: MissionAssistanceSnapshot;
  createdAt: string;
};

export type MissionRunBest = {
  attemptNumber: number;
  score: number;
  stars: number;
  completedAt?: string;
};

export type MissionCompletionResult = {
  missionRunId: string;
  missionEvaluationId: string;
  rewardUnlockId: string;
  score: number;
  stars: number;
  experiencePointsAwarded: number;
  alreadyCompleted: boolean;
};

export type MissionRun = {
  id: string;
  missionId: string;
  missionTitle: string;
  missionVersionId?: string;
  characterId: string;
  characterVersionId?: string;
  conversationId?: string;
  status: MissionRunStatus;
  currentStepOrder: number;
  attemptNumber: number;
  turnCount: number;
  score?: number;
  stars?: number;
  steps: MissionRunStep[];
  evaluation?: MissionEvaluation;
  completion?: MissionCompletionResult;
  rewardId?: string;
  best?: MissionRunBest;
  reviewNote?: string;
  startedAt?: string;
  completedAt?: string;
};

export type StartMissionRunInput = {
  missionId: string;
  missionTitle?: string;
  characterId: string;
  conversationId?: string;
  modelId?: string;
  steps?: Array<{ id: string; label: string; required?: boolean }>;
};

export type UpdateMissionProgressInput = {
  runId: string;
  stepId: string;
  status: Exclude<MissionStepStatus, "locked">;
  evidenceMessageIds?: string[];
  score?: number;
  feedback?: string;
  turnCount?: number;
};

export type MissionEvaluationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type EvaluateMissionInput = {
  runId: string;
  messages: MissionEvaluationMessage[];
};

export type CompleteMissionRunInput = {
  runId: string;
  evaluationId: string;
  rewardId: string;
};

export type MissionEvaluationResponse = {
  evaluation: MissionEvaluation;
  rewardId?: string;
  run: MissionRun;
};

export type MissionCompletionResponse = {
  result: MissionCompletionResult;
  run: MissionRun;
};

export type ReviewNote = {
  runId: string;
  note: string;
  updatedAt: string;
};
