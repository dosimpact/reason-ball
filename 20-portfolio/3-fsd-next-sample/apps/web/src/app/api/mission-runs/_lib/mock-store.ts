import type {
  MissionCompletionResponse,
  MissionEvaluation,
  MissionEvaluationMessage,
  MissionEvaluationResponse,
  MissionRun,
  MissionRunBest,
  ReviewNote,
  StartMissionRunInput,
  UpdateMissionProgressInput,
} from "@/entities/mission-run/model/types";

import { planMissionRunStart } from "@/entities/mission-run/model/resume-policy";
import { SupabaseHttpError } from "@/shared/api/supabase/http";

const SESSION_COOKIE = "lingua-mock-learning-session";

type InternalRun = MissionRun & { rewardId?: string };
type MockSession = {
  counter: number;
  runs: InternalRun[];
  notes: Map<string, ReviewNote>;
};

type GlobalMockState = typeof globalThis & {
  __linguaMissionRunSessions?: Map<string, MockSession>;
};

function sessions() {
  const state = globalThis as GlobalMockState;
  state.__linguaMissionRunSessions ??= new Map();
  return state.__linguaMissionRunSessions;
}

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((item) => item.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
}

export function getMockSession(request: Request) {
  const sessionId = cookieValue(request) ?? crypto.randomUUID();
  const existing = sessions().get(sessionId);
  if (existing) return { session: existing, sessionId };
  const session: MockSession = { counter: 0, runs: [], notes: new Map() };
  sessions().set(sessionId, session);
  return { session, sessionId };
}

export function withMockSession(response: Response, sessionId: string) {
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
  );
  return response;
}

function nextId(session: MockSession) {
  session.counter += 1;
  return `00000000-0000-4000-8000-${String(session.counter).padStart(12, "0")}`;
}

function nextTimestamp(session: MockSession) {
  return new Date(Date.UTC(2026, 8, 5, 12, 0, session.counter)).toISOString();
}

function bestFor(session: MockSession, missionId: string): MissionRunBest | undefined {
  const best = session.runs
    .filter((run) => run.missionId === missionId && run.score !== undefined)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
  if (!best || best.score === undefined) return undefined;
  return {
    attemptNumber: best.attemptNumber,
    score: best.score,
    stars: best.stars ?? 0,
    completedAt: best.completedAt,
  };
}

function publicRun(session: MockSession, run: InternalRun): MissionRun {
  const note = session.notes.get(run.id);
  return {
    ...run,
    best: bestFor(session, run.missionId),
    reviewNote: note?.note,
  };
}

function defaultSteps(input: StartMissionRunInput) {
  const configured = input.steps?.length
    ? input.steps
    : [
        { id: "greeting", label: "먼저 인사하고 체크인 의사 말하기", required: true },
        { id: "reservation", label: "예약자 이름 말하기", required: true },
        { id: "breakfast", label: "조식 시간 묻기", required: true },
      ];
  return configured.map((step, index) => ({
    id: step.id,
    label: step.label,
    required: step.required ?? true,
    order: index + 1,
    status: index === 0 ? ("active" as const) : ("locked" as const),
    attempts: 0,
    evidenceMessageIds: [],
  }));
}

export function listMockRuns(session: MockSession) {
  return session.runs.map((run) => publicRun(session, run));
}

export function findMockRun(session: MockSession, runId: string) {
  return session.runs.find((run) => run.id === runId);
}

export function getMockRun(session: MockSession, runId: string) {
  const run = findMockRun(session, runId);
  return run ? publicRun(session, run) : undefined;
}

export function startMockRun(session: MockSession, input: StartMissionRunInput) {
  const plan = planMissionRunStart(session.runs, input);
  if (plan.kind === "conflict") throw new SupabaseHttpError(409, "CONVERSATION_CONTEXT_MISMATCH", "The conversation belongs to a different mission or character.");
  if (plan.kind === "resume") return publicRun(session, plan.run);

  const id = nextId(session);
  const run: InternalRun = {
    id,
    missionId: input.missionId,
    missionTitle: input.missionTitle ?? "영어 회화 미션",
    characterId: input.characterId,
    conversationId: input.conversationId,
    status: "in-progress",
    currentStepOrder: 1,
    attemptNumber:
      session.runs.filter((item) => item.missionId === input.missionId).length + 1,
    turnCount: 0,
    steps: defaultSteps(input),
    startedAt: nextTimestamp(session),
  };
  session.runs.unshift(run);
  return publicRun(session, run);
}

export function updateMockProgress(
  session: MockSession,
  input: UpdateMissionProgressInput,
) {
  const run = findMockRun(session, input.runId);
  if (!run) return undefined;
  const step = run.steps.find((item) => item.id === input.stepId);
  if (!step) return undefined;
  step.status = input.status;
  step.attempts += 1;
  step.evidenceMessageIds = input.evidenceMessageIds ?? step.evidenceMessageIds;
  step.score = input.score;
  step.feedback = input.feedback;
  run.turnCount = Math.max(run.turnCount, input.turnCount ?? 0);
  const next = run.steps.find((item) => item.status === "locked");
  if (input.status === "completed" && next) next.status = "active";
  run.currentStepOrder =
    run.steps.find((item) => item.status === "active")?.order ?? run.steps.length;
  return publicRun(session, run);
}

function evidence(messages: MissionEvaluationMessage[], pattern: RegExp) {
  const matched = messages.find(
    (message) => message.role === "user" && pattern.test(message.text.toLowerCase()),
  );
  return matched
    ? [{ messageId: matched.id, quote: matched.text.slice(0, 180), rationale: "학습자의 실제 발화에서 성공 근거를 확인했어요." }]
    : [];
}

export function evaluateMockRun(
  session: MockSession,
  runId: string,
  messages: MissionEvaluationMessage[],
): MissionEvaluationResponse | undefined {
  const run = findMockRun(session, runId);
  if (!run) return undefined;
  const userMessages = messages.filter((message) => message.role === "user");
  const patterns = [/hello|hi|check\s*in|체크인/i, /reservation|under|예약|passport|여권/i, /breakfast|조식/i];
  const completedStepIds = run.steps.flatMap((step, index) => {
    const stepEvidence = evidence(messages, patterns[index] ?? /please|could|thank/i);
    if (stepEvidence.length === 0 && !userMessages[index]) return [];
    step.status = "completed";
    step.attempts += 1;
    step.evidenceMessageIds = stepEvidence[0]?.messageId ? [stepEvidence[0].messageId] : [userMessages[index].id];
    step.score = 90;
    return [step.id];
  });
  const required = run.steps.filter((step) => step.required);
  const completedRequired = required.filter((step) => step.status === "completed").length;
  const taskScore = Math.round((completedRequired / Math.max(1, required.length)) * 100);
  const politeEvidence = evidence(messages, /please|thank|could|may i|실례/i);
  const targetEvidence = evidence(messages, /reservation|under|breakfast|check\s*in/i);
  const fallbackEvidence = userMessages[0]
    ? [{ messageId: userMessages[0].id, quote: userMessages[0].text.slice(0, 180), rationale: "평가에 사용한 대표 학습자 발화예요." }]
    : [];
  const appropriateness = politeEvidence.length ? 92 : userMessages.length ? 76 : 0;
  const grammar = userMessages.length ? 86 : 0;
  const vocabulary = targetEvidence.length ? 90 : userMessages.length ? 70 : 0;
  const totalScore = Math.round(
    taskScore * 0.4 + appropriateness * 0.2 + grammar * 0.2 + vocabulary * 0.2,
  );
  const passed = completedRequired === required.length && totalScore >= 70;
  const stars = passed ? (totalScore >= 90 ? 3 : totalScore >= 80 ? 2 : 1) : 0;
  const evaluationId = nextId(session);
  const evaluation: MissionEvaluation = {
    id: evaluationId,
    runId,
    status: "completed",
    passed,
    totalScore,
    stars,
    axes: [
      { key: "taskCompletion", label: "과업 완수", score: taskScore, evidence: targetEvidence.length ? targetEvidence : fallbackEvidence },
      { key: "appropriateness", label: "상황 적절성", score: appropriateness, evidence: politeEvidence.length ? politeEvidence : fallbackEvidence },
      { key: "grammar", label: "문법·명료성", score: grammar, evidence: fallbackEvidence },
      { key: "vocabulary", label: "어휘 활용", score: vocabulary, evidence: targetEvidence.length ? targetEvidence : fallbackEvidence },
    ],
    summary: passed
      ? "필수 상황을 모두 영어로 해결했어요. 실제 여행에서도 바로 활용할 수 있는 흐름이에요."
      : "좋은 시작이에요. 아직 완료하지 못한 필수 단계를 한 번 더 연습해 보세요.",
    strengths: ["상대가 이해하기 쉬운 짧은 문장을 사용했어요.", "상황에 맞는 핵심 표현을 시도했어요."],
    improvements: passed ? ["문장 사이를 자연스럽게 연결해 보세요."] : ["예약 확인과 조식 질문을 모두 포함해 보세요."],
    corrections: userMessages.length
      ? [{ original: userMessages[0].text, suggested: userMessages[0].text.trim(), explanation: "의미는 분명해요. 정중한 please를 더하면 더 자연스러워요." }]
      : [],
    completedStepIds,
    vocabularyObserved: ["check in", "reservation", "breakfast"].filter((word) =>
      messages.some((message) => message.text.toLowerCase().includes(word)),
    ),
    createdAt: nextTimestamp(session),
  };
  run.evaluation = evaluation;
  run.score = totalScore;
  run.stars = stars;
  run.turnCount = messages.length;
  run.status = passed ? "evaluating" : "failed";
  run.rewardId = nextId(session);
  return { evaluation, rewardId: passed ? run.rewardId : undefined, run: publicRun(session, run) };
}

export function completeMockRun(
  session: MockSession,
  runId: string,
  evaluationId: string,
  rewardId: string,
): MissionCompletionResponse | { error: string } | undefined {
  const run = findMockRun(session, runId);
  if (!run) return undefined;
  if (run.completion) {
    return {
      result: { ...run.completion, alreadyCompleted: true },
      run: publicRun(session, run),
    };
  }
  if (!run.evaluation?.passed || run.evaluation.id !== evaluationId || run.rewardId !== rewardId) {
    return { error: "A passing evaluation and its matching reward are required." };
  }
  if (run.steps.some((step) => step.required && step.status !== "completed")) {
    return { error: "Every required mission step must be completed." };
  }
  const result = {
    missionRunId: run.id,
    missionEvaluationId: evaluationId,
    rewardUnlockId: nextId(session),
    score: run.evaluation.totalScore,
    stars: run.evaluation.stars,
    experiencePointsAwarded: 120,
    alreadyCompleted: false,
  };
  run.status = "passed";
  run.completedAt = nextTimestamp(session);
  run.completion = result;
  return { result, run: publicRun(session, run) };
}

export function readMockNote(session: MockSession, runId: string) {
  return session.notes.get(runId) ?? {
    runId,
    note: "",
    updatedAt: "2026-09-05T12:00:00.000Z",
  };
}

export function writeMockNote(session: MockSession, runId: string, note: string) {
  const saved = { runId, note, updatedAt: nextTimestamp(session) };
  session.notes.set(runId, saved);
  return saved;
}
