import { expect, test } from "@playwright/test";

import { installChatBrowserStubs, installCleanAppState } from "./test-setup";

test.describe("Mission learning loop", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
    await installChatBrowserStubs(page);
  });

  test("evaluates evidence, completes once, and restores the review note", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    const api = page.context().request;
    const startResponse = await api.post("/api/mission-runs", {
      data: {
        missionId: "hotel-check-in",
        missionTitle: "호텔 체크인",
        characterId: "mia-hotelier",
        steps: [
          { id: "greeting", label: "인사하고 체크인 말하기", required: true },
          { id: "reservation", label: "예약자 이름 말하기", required: true },
          { id: "breakfast", label: "조식 시간 묻기", required: true },
        ],
      },
    });
    expect(startResponse.ok()).toBe(true);
    const { run } = (await startResponse.json()) as { run: { id: string; attemptNumber: number } };

    const evaluationResponse = await api.post("/api/ai/evaluate", {
      data: {
        runId: run.id,
        messages: [
          { id: "learner-1", role: "user", text: "Hello, I would like to check in, please." },
          { id: "mia-1", role: "assistant", text: "Welcome. What name is the reservation under?" },
          { id: "learner-2", role: "user", text: "The reservation is under Kim." },
          { id: "mia-2", role: "assistant", text: "I found it. Anything else?" },
          { id: "learner-3", role: "user", text: "Thank you. What time is breakfast?" },
          { id: "mia-3", role: "assistant", text: "Breakfast starts at seven." },
        ],
      },
    });
    expect(evaluationResponse.ok()).toBe(true);
    const evaluation = (await evaluationResponse.json()) as {
      evaluation: { id: string; passed: boolean; axes: unknown[] };
      rewardId: string;
    };

    const completionResponse = await api.post(`/api/mission-runs/${run.id}/complete`, {
      data: { evaluationId: evaluation.evaluation.id, rewardId: evaluation.rewardId },
    });
    expect(completionResponse.ok()).toBe(true);
    const completion = (await completionResponse.json()) as {
      result: { experiencePointsAwarded: number; alreadyCompleted: boolean };
    };
    const repeatResponse = await api.post(`/api/mission-runs/${run.id}/complete`, {
      data: { evaluationId: evaluation.evaluation.id, rewardId: evaluation.rewardId },
    });
    expect(repeatResponse.ok()).toBe(true);
    const repeat = (await repeatResponse.json()) as { result: { alreadyCompleted: boolean } };
    const noteResponse = await api.put(`/api/mission-runs/${run.id}/review-note`, {
      data: { note: "Could I check in, please?를 먼저 말하기" },
    });
    expect(noteResponse.ok()).toBe(true);
    const runsResponse = await api.get("/api/mission-runs");
    expect(runsResponse.ok()).toBe(true);
    const runs = (await runsResponse.json()) as {
      runs: Array<{ best?: { score: number }; reviewNote?: string }>;
    };
    const result = { run, evaluation, completion, repeat, runs };

    expect(result.run.attemptNumber).toBe(1);
    expect(result.evaluation.evaluation.passed).toBe(true);
    expect(result.evaluation.evaluation.axes).toHaveLength(4);
    expect(result.completion.result.experiencePointsAwarded).toBe(120);
    expect(result.completion.result.alreadyCompleted).toBe(false);
    expect(result.repeat.result.alreadyCompleted).toBe(true);
    expect(result.runs.runs[0]?.best?.score).toBeGreaterThanOrEqual(70);

    await page.reload();
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("tab", { name: "복습 노트" }).click();
    await expect(page.getByTestId("profile-review-notes")).toContainText(
      "Could I check in, please?를 먼저 말하기",
    );
  });

  test("exposes voice preferences, disclosure, and deterministic TTS caching", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("tab", { name: "설정" }).click();
    await expect(page.getByTestId("profile-settings")).toBeVisible();
    await expect(page.getByText("AI로 생성된 음성입니다.")).toBeVisible();

    await page.getByLabel("표시 이름").fill("지수");
    await page.getByLabel("학습자 레벨").selectOption("B1");
    await page.getByLabel("하루 학습 목표").selectOption("20");
    await page.getByLabel("기본 AI 음성").selectOption("coral");
    await page.getByLabel("기본 음성 속도").selectOption("0.75");
    await page.getByLabel("새 표현 자동 재생").check();
    await page.getByRole("button", { name: "설정 저장" }).click();
    await expect(page.getByText("학습 설정을 저장했어요.")).toBeVisible();

    const cache = await page.evaluate(async () => {
      const messageId = "10000000-0000-4000-8000-000000000001";
      const body = JSON.stringify({
        text: "Could I check in, please?",
        voice: "coral",
        speed: 0.75,
        messageId,
        messageRevision: 1,
      });
      await fetch("/api/ai/speech", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const first = await fetch("/api/ai/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const second = await fetch("/api/ai/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      return {
        first: first.headers.get("x-tts-cache"),
        second: second.headers.get("x-tts-cache"),
        disclosure: second.headers.get("x-ai-voice-disclosure"),
      };
    });
    expect(cache).toEqual({ first: "MISS", second: "HIT", disclosure: "AI-generated" });

    await page.reload();
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByRole("heading", { level: 1, name: "지수의 영어 여정" })).toBeVisible();
    await expect(page.getByText("하루 20분 목표")).toBeVisible();
    await page.getByRole("tab", { name: "설정" }).click();
    await expect(page.getByLabel("표시 이름")).toHaveValue("지수");
    await expect(page.getByLabel("학습자 레벨")).toHaveValue("B1");
    await expect(page.getByLabel("하루 학습 목표")).toHaveValue("20");
    await expect(page.getByLabel("기본 AI 음성")).toHaveValue("coral");
    await expect(page.getByLabel("기본 음성 속도")).toHaveValue("0.75");
    await expect(page.getByLabel("새 표현 자동 재생")).toBeChecked();

    await page.evaluate(() => {
      const key = "lingua-character-lab";
      const persisted = JSON.parse(window.localStorage.getItem(key) ?? '{"state":{"missions":[]},"version":1}') as {
        state?: { missions?: unknown[]; ownedMissionIds?: string[] };
      };
      if (!persisted.state?.missions) throw new Error("Mock learning state is missing");
      persisted.state.ownedMissionIds = [...(persisted.state.ownedMissionIds ?? []), "my-airport-mission"];
      persisted.state.missions.unshift({
        id: "my-airport-mission",
        title: "내 공항 미션",
        subtitle: "탑승구 변경을 영어로 확인하기",
        description: "공항 직원에게 새 탑승구를 묻습니다.",
        category: "여행",
        location: "Airport",
        difficulty: "초급",
        durationMinutes: 5,
        objectives: [{ id: "gate", label: "탑승구 묻기", hint: "Which gate?" }],
        keyPhrases: [{ english: "Which gate should I go to?", korean: "어느 탑승구로 가야 하나요?" }],
        rewardTitle: "공항 안내 카드",
        rewardPalette: ["#334477", "#99aadd"],
        rewardEmoji: "✈️",
        recommendedCharacterId: "mia-hotelier",
        publishStatus: "draft",
        learnerCount: 0,
        createdAt: "2026-09-05T12:00:00.000Z",
      });
      window.localStorage.setItem(key, JSON.stringify(persisted));
    });
    await page.reload();
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("tab", { name: "내 생성물" }).click();
    const createdMission = page.getByTestId("profile-created-mission-my-airport-mission");
    await expect(createdMission).toContainText("내 공항 미션");
    await expect(createdMission).toContainText("초안");
    await expect(createdMission.getByRole("link", { name: "미션 편집하기" })).toHaveAttribute(
      "href",
      "/missions/my-airport-mission/edit",
    );
  });
});
