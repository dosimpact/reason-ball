import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionProgressPanel } from "../../src/widgets/chat-workspace/ui/mission-progress-panel";
import type { MissionRun } from "../../src/entities/mission-run/model/types";

const run: MissionRun = {
  id: "run", missionId: "mission", missionTitle: "Cafe", characterId: "character", status: "in-progress",
  currentStepOrder: 1, attemptNumber: 1, turnCount: 1,
  steps: [
    { id: "greeting", label: "Introduce yourself", required: true, order: 1, status: "active", attempts: 0, evidenceMessageIds: [] },
    { id: "price", label: "Ask the price", required: true, order: 2, status: "completed", attempts: 1, evidenceMessageIds: ["message"] },
  ],
};
function render(value?: MissionRun, failed = false) {
  return renderToStaticMarkup(createElement(MissionProgressPanel, { run: value, title: "Cafe", failed, loading: false, onRetry() {} }));
}

test("progress shows each actual step status when later goals complete first", () => {
  const original = structuredClone(run);
  const html = render({ ...run, steps: [...run.steps].reverse() });
  expect(html).toContain('data-testid="mission-progress-step-greeting" data-status="active" aria-current="step"');
  expect(html).toContain('data-testid="mission-progress-step-price" data-status="completed"');
  expect(html).toContain("현재 단계: Introduce yourself");
  expect(html.indexOf("mission-progress-step-greeting")).toBeLessThan(html.indexOf("mission-progress-step-price"));
  expect(run).toEqual(original);
});

test("missing and failed progress do not fabricate a current step or completed goals", () => {
  expect(render()).toContain("목표 진행을 불러오는 중이에요.");
  expect(render(undefined, true)).toContain("목표 진행 다시 불러오기");
  expect(render(undefined, true)).not.toContain('data-status="completed"');
  const complete = render({ ...run, steps: run.steps.map(step => ({ ...step, status: "completed" })) });
  expect(complete).toContain("필수 목표를 모두 달성했어요.");
  expect(complete).toContain("최종 평가와 보상은 그때 확인해요.");
  expect(complete).not.toContain('aria-current="step"');
});
