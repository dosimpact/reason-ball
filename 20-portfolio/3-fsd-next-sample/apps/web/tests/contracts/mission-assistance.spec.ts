import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "@playwright/test";
import { MissionAssistance } from "../../src/features/mission-reward/ui/mission-assistance";
import type { MissionEvaluation, MissionAssistanceSnapshot } from "../../src/entities/mission-run/model/types";

function render(assistance?: MissionAssistanceSnapshot, passed = true) {
  const evaluation: MissionEvaluation = {
    id: "evaluation", runId: "run", status: "completed", passed, totalScore: 80, stars: 2,
    axes: [], summary: "Practice", strengths: [], improvements: [], corrections: [],
    completedStepIds: [], vocabularyObserved: [], createdAt: "2026-09-11T00:00:00Z", assistance,
  };
  return renderToStaticMarkup(createElement(MissionAssistance, { evaluation }));
}
const empty = { requestCount: 0, maxDepth: 0 as const, steps: [], capturedAt: "2026-09-11T00:00:00Z" };

test("legacy or unknown help evidence never claims independent completion", () => {
  for (const value of [undefined, { ...empty, status: "unknown" as const }]) {
    expect(render(value)).toContain("도움 사용 기록 없음");
    expect(render(value)).not.toContain("자립 완료");
    expect(render(value)).not.toContain("힌트 요청 0회");
  }
});

test("only tracked zero-help success claims independence; failed and assisted runs remain distinct", () => {
  const independent = { ...empty, status: "tracked" as const };
  expect(render(independent)).toContain("자립 완료");
  expect(render(independent, false)).toContain("힌트 없이 연습 중");
  expect(render(independent, false)).not.toContain("자립 완료");
  const assisted = { ...independent, requestCount: 3, maxDepth: 3 as const, steps: [{ stepId: "step", maxDepth: 3 as const, requestCount: 3 }] };
  expect(render(assisted)).toContain("도움을 받아 완료");
  expect(render(assisted)).not.toContain("자립 완료");
  expect(render(assisted)).toContain("점수와 보상이 줄어들지 않습니다");
});
