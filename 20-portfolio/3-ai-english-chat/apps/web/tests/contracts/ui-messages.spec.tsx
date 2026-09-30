/** @jsxImportSource react */
import { test, expect } from "@playwright/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { koreanUiMessages, type UiMessages } from "../../src/shared/i18n/ui-messages";
import { UiMessagesProvider } from "../../src/shared/i18n/ui-messages-provider";
import { MissionResultPanel } from "../../src/features/mission-reward/ui/mission-result-panel";
import { AudioPlaybackButton } from "../../src/features/audio-playback/ui/audio-playback-button";
import { MessageLearningHelp } from "../../src/features/learning-assistance/ui/message-learning-help";
import { LearningHelpResult } from "../../src/features/learning-assistance/ui/learning-help-result";
import type { MissionEvaluationResponse } from "../../src/entities/mission-run/model/types";
import type { AssistanceResponse } from "../../src/entities/learning-assistance/model/assistance";

// A test-only replacement, not an advertised second product locale.
const alternate: UiMessages = {
  ...koreanUiMessages, languageTag: "en",
  missionResult: {
    ...koreanUiMessages.missionResult, passedTitle: "PASS TITLE", practiceTitle: "PRACTICE TITLE",
    saveNote: "SAVE NOTE", totalScore: "SCORE LABEL", stars: count => `${count} STARS`,
  },
  audio: {
    ...koreanUiMessages.audio,
    labels: { ...koreanUiMessages.audio.labels, idle: "LISTEN CONTROL" },
    voice: "VOICE LABEL", rate: "RATE LABEL", disclosure: "GENERATED AUDIO NOTICE",
  },
  learningHelp: {
    ...koreanUiMessages.learningHelp, title: "HELP TITLE", rephrase: "REPHRASE CONTROL",
    correction: "CORRECT CONTROL", reply: "REPLY CONTROL", explanation: "EXPLANATION CONTROL",
    append: "APPEND CONTROL", generated: "GENERATED HELP", demo: "DEMO HELP",
  },
};

function render(view: ReactNode, messages?: UiMessages) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    return renderToStaticMarkup(<QueryClientProvider client={queryClient}>
      <UiMessagesProvider messages={messages}>{view}</UiMessagesProvider>
    </QueryClientProvider>);
  } finally { queryClient.clear(); }
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function evaluation(passed: boolean): MissionEvaluationResponse {
  return freezeDeep({
    run: { id: "run-copy", missionId: "mission-copy", missionTitle: "Hotel check-in", characterId: "character-copy",
      status: passed ? "passed" : "failed", currentStepOrder: 1, attemptNumber: 1, turnCount: 2, steps: [], reviewNote: "Remember my room request." },
    evaluation: { id: "evaluation-copy", runId: "run-copy", status: "completed", passed,
      totalScore: 81, stars: 2, createdAt: "2026-09-11T00:00:00Z", summary: "정중하게 객실을 요청했어요.",
      strengths: ["요청의 목적이 분명해요."], improvements: ["관사를 한 번 더 확인해 보세요."],
      axes: [{ key: "grammar", label: "저장된 문법 평가", score: 81, evidence: [{ messageId: "message-copy", quote: "I need room.", rationale: "관사를 보완할 수 있어요." }] }],
      corrections: [{ original: "I need room.", suggested: "I need a room.", explanation: "셀 수 있는 명사 앞에 관사를 넣어요." }],
      completedStepIds: [], vocabularyObserved: ["room"],
    },
  });
}

for (const passed of [true, false]) {
  test(`real mission result ${passed ? "passed" : "practice"} view substitutes UI copy while preserving stored learning content`, () => {
    const result = evaluation(passed);
    const before = JSON.stringify(result);
    const original = render(<MissionResultPanel result={result} />);
    const changed = render(<MissionResultPanel result={result} />, alternate);
    expect(original).toContain(passed ? "미션을 해결했어요!" : "거의 다 왔어요");
    expect(changed).toContain(passed ? "PASS TITLE" : "PRACTICE TITLE");
    expect(changed).not.toContain(passed ? "미션을 해결했어요!" : "거의 다 왔어요");
    expect(original).toContain("메모 저장"); expect(changed).toContain("SAVE NOTE");
    expect(original).toContain('aria-label="2점 별점"'); expect(changed).toContain('aria-label="2 STARS"');
    // Includes the real nested AudioPlaybackButton, not a stub.
    expect(original).toContain('aria-label="AI 음성 듣기"'); expect(changed).toContain('aria-label="LISTEN CONTROL"');
    for (const content of [result.evaluation.summary, "저장된 문법 평가", "I need room.", "I need a room.", "셀 수 있는 명사 앞에 관사를 넣어요.", "Remember my room request."]) {
      expect(original).toContain(content); expect(changed).toContain(content);
    }
    expect(JSON.stringify(result)).toBe(before);
  });
}

test("real audio idle controls substitute labels without changing selected voice and rate", () => {
  const view = <AudioPlaybackButton playbackId="copy-audio" text="I need a room." defaultVoice="coral" defaultRate={1.25} autoplay={false} showSettings />;
  const original = render(view); const changed = render(view, alternate);
  expect(original).toContain('aria-label="AI 음성 듣기"'); expect(changed).toContain('aria-label="LISTEN CONTROL"');
  expect(original).toContain("AI로 생성된 음성입니다."); expect(changed).toContain("GENERATED AUDIO NOTICE");
  expect(changed).toContain("VOICE LABEL"); expect(changed).toContain("RATE LABEL");
  for (const markup of [original, changed]) {
    expect(markup).toContain('<option value="coral" selected="">Coral</option>');
    expect(markup).toContain('<option value="1.25" selected="">1.25×</option>');
  }
});

test("real learning help initial views use role-specific interface resources", () => {
  for (const role of ["user", "assistant"] as const) {
    const view = <MessageLearningHelp text="I need a room." role={role} disabled={false}
      makeRequest={mode => ({ conversationId: "c", messageId: "m", mode })} onUse={() => { throw new Error("SSR must not append content"); }} />;
    const original = render(view); const changed = render(view, alternate);
    expect(original).toContain("학습 도움"); expect(changed).toContain("HELP TITLE");
    expect(original).toContain(role === "user" ? "문장 교정" : "답변 추천");
    expect(changed).toContain(role === "user" ? "CORRECT CONTROL" : "REPLY CONTROL");
    expect(changed).not.toContain(role === "user" ? "REPLY CONTROL" : "CORRECT CONTROL");
  }
});

test("production help result retains English and Korean content language when UI resources change", () => {
  const response = freezeDeep<AssistanceResponse>({ mode: "correction", messageId: "m", targetText: "I need room.", source: "provider",
    result: { brief: "관사를 넣어 보세요.", suggestion: "I need a room.", explanation: "단수 명사 room 앞에 a를 써요." } });
  const before = JSON.stringify(response);
  const view = <LearningHelpResult response={response} disabled={false} onUse={() => { throw new Error("SSR must not append content"); }} />;
  const original = render(view); const changed = render(view, alternate);
  expect(original).toContain("자세한 설명"); expect(changed).toContain("EXPLANATION CONTROL");
  expect(original).toContain("도움 문장을 입력창에 덧붙이기"); expect(changed).toContain("APPEND CONTROL");
  expect(changed).toMatch(/<summary lang="en"[^>]*>EXPLANATION CONTROL<\/summary>/);
  for (const markup of [original, changed]) {
    expect(markup).toMatch(/<p lang="en"[^>]*>I need a room\.<\/p>/);
    expect(markup).toMatch(/<p lang="ko"[^>]*>관사를 넣어 보세요\.<\/p>/);
    expect(markup).toMatch(/<p lang="ko"[^>]*>단수 명사 room 앞에 a를 써요\.<\/p>/);
  }
  expect(JSON.stringify(response)).toBe(before);
});

test("character reaction requires matching confirmed completion and preserves pinned display identity", () => {
  const result = evaluation(true);
  const character = freezeDeep({ id: "character-copy", name: "Pinned Mira", emoji: "🌱", palette: ["#123456", "#abcdef"] as [string, string] });
  const completion = { missionRunId: result.run.id, missionEvaluationId: result.evaluation.id,
    rewardUnlockId: "unlock-copy", score: 81, stars: 2, experiencePointsAwarded: 20, alreadyCompleted: false };
  const reaction = 'data-testid="reward-character-reaction"';
  expect(render(<MissionResultPanel result={result} character={character} />)).not.toContain(reaction);
  expect(render(<MissionResultPanel result={evaluation(false)} completion={completion} character={character} />)).not.toContain(reaction);
  expect(render(<MissionResultPanel result={result} completion={{ ...completion, missionEvaluationId: "stale-evaluation" }} character={character} />)).not.toContain(reaction);
  expect(render(<MissionResultPanel result={result} completion={{ ...completion, missionRunId: "other-run" }} character={character} />)).not.toContain(reaction);
  expect(render(<MissionResultPanel result={result} completion={completion} character={{ ...character, id: "other-character" }} />)).not.toContain(reaction);
  const original = render(<MissionResultPanel result={result} completion={completion} character={character} />);
  expect(original).toContain(reaction); expect(original).toContain("Pinned Mira"); expect(original).toContain("🌱");
  expect(original).toContain(koreanUiMessages.missionResult.characterReaction);
  const replacement = { ...alternate, missionResult: { ...alternate.missionResult, characterReaction: "CURATED CONGRATULATIONS" } };
  const restored = render(<MissionResultPanel result={{ ...result, run: { ...result.run, completion: { ...completion, alreadyCompleted: true } } }} character={character} />, replacement);
  expect(restored).toContain(reaction); expect(restored).toContain("Pinned Mira");
  expect(restored).toContain("CURATED CONGRATULATIONS"); expect(restored).toContain(result.evaluation.summary);
});
