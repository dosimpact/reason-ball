import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

const missionId = "hotel-check-in";
const rawRewardUrl =
  "https://private.example.invalid/original-reward.png?token=raw-secret";
const rewardMissionFixture = {
  id: missionId,
  title: "호텔 체크인하기",
  subtitle: "예약 확인부터 조식 시간 질문까지",
  description: "호텔 체크인 영어를 연습합니다.",
  category: "여행",
  location: "London · Hotel Lobby",
  difficulty: "입문",
  durationMinutes: 7,
  objectives: [
    {
      id: "reservation",
      label: "예약자 이름 말하기",
      hint: "I have a reservation under...",
    },
  ],
  keyPhrases: [
    { english: "I'd like to check in.", korean: "체크인하고 싶어요." },
  ],
  rewardTitle: "Mia의 런던 야경",
  rewardPalette: ["#342a70", "#fa8c73"],
  rewardEmoji: "🌃",
  rewardImageUrl: rawRewardUrl,
  recommendedCharacterId: "mia-hotelier",
  learnerCount: 18_730,
  createdAt: "2026-08-10T09:00:00.000Z",
};

test.describe("Mission reward confidentiality", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("keeps the original out of locked DOM and requests signed access only after unlock", async ({
    page,
  }) => {
    const observedRequests: string[] = [];
    page.on("request", (request) => observedRequests.push(request.url()));

    await page.goto("/profile");
    await expect(page.getByTestId("profile-page")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page.evaluate((mission) => {
      window.localStorage.setItem(
        "lingua-character-lab",
        JSON.stringify({ state: { missions: [mission] }, version: 1 }),
      );
    }, rewardMissionFixture);

    await page.reload();
    await expect(page.getByTestId("profile-page")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page.getByRole("tab", { name: "보상 컬렉션" }).click();

    const lockedReward = page.getByTestId(`reward-${missionId}`);
    await expect(lockedReward).toHaveAttribute("data-reward-state", "locked");
    const lockedMarkup = await lockedReward.evaluate(
      (element) => element.outerHTML,
    );
    expect(lockedMarkup).not.toContain(rawRewardUrl);
    expect(lockedMarkup).not.toContain("raw-secret");
    expect(
      observedRequests.some((url) => url.includes("private.example.invalid")),
    ).toBe(false);
    expect(
      observedRequests.filter((url) =>
        new URL(url).pathname.startsWith("/api/uploads/rewards/"),
      ),
    ).toHaveLength(0);

    const api = page.context().request;
    const deniedRewardResponse = await api.get(
      `/api/uploads/rewards/${missionId}`,
    );
    expect(deniedRewardResponse.status()).toBe(404);
    await expect(deniedRewardResponse.json()).resolves.toMatchObject({
      error: { code: "REWARD_NOT_UNLOCKED" },
    });

    const startResponse = await api.post("/api/mission-runs", {
      data: {
        missionId,
        missionTitle: "호텔 체크인하기",
        characterId: "mia-hotelier",
        steps: [
          { id: "greeting", label: "인사하고 체크인 말하기", required: true },
          { id: "reservation", label: "예약자 이름 말하기", required: true },
          { id: "breakfast", label: "조식 시간 묻기", required: true },
        ],
      },
    });
    expect(startResponse.ok()).toBe(true);
    const { run } = (await startResponse.json()) as { run: { id: string } };

    const evaluationResponse = await api.post("/api/ai/evaluate", {
      data: {
        runId: run.id,
        messages: [
          {
            id: "learner-1",
            role: "user",
            text: "Hello, I would like to check in, please.",
          },
          {
            id: "learner-2",
            role: "user",
            text: "The reservation is under Kim and here is my passport.",
          },
          {
            id: "learner-3",
            role: "user",
            text: "Thank you. What time is breakfast?",
          },
        ],
      },
    });
    expect(evaluationResponse.ok()).toBe(true);
    const evaluation = (await evaluationResponse.json()) as {
      evaluation: { id: string };
      rewardId: string;
    };
    const completionResponse = await api.post(
      `/api/mission-runs/${run.id}/complete`,
      {
        data: {
          evaluationId: evaluation.evaluation.id,
          rewardId: evaluation.rewardId,
        },
      },
    );
    expect(completionResponse.ok()).toBe(true);

    await page.evaluate((id) => {
      const storageKey = "lingua-character-lab";
      const persisted = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "{}",
      ) as {
        state?: {
          completedMissionIds?: string[];
          unlockedRewardIds?: string[];
        };
      };
      if (!persisted.state) throw new Error("Mock learning fixture is missing.");
      persisted.state.completedMissionIds = [
        ...new Set([...(persisted.state.completedMissionIds ?? []), id]),
      ];
      persisted.state.unlockedRewardIds = [
        ...new Set([...(persisted.state.unlockedRewardIds ?? []), id]),
      ];
      window.localStorage.setItem(storageKey, JSON.stringify(persisted));
    }, missionId);

    await page.reload();
    await expect(page.getByTestId("profile-page")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    const signedAccessResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === `/api/uploads/rewards/${missionId}`
      );
    });
    await page.getByRole("tab", { name: "보상 컬렉션" }).click();
    expect((await signedAccessResponse).ok()).toBe(true);

    const unlockedReward = page.getByTestId(`reward-${missionId}`);
    await expect(unlockedReward).toHaveAttribute("data-reward-state", "ready");
    await expect(unlockedReward).toContainText("해금됨");
    const unlockedMarkup = await unlockedReward.evaluate(
      (element) => element.outerHTML,
    );
    expect(unlockedMarkup).toContain("data:image/svg+xml;base64,");
    expect(unlockedMarkup).not.toContain(rawRewardUrl);
    expect(unlockedMarkup).not.toContain("raw-secret");
    expect(
      observedRequests.some((url) => url.includes("private.example.invalid")),
    ).toBe(false);
    expect(
      observedRequests.filter(
        (url) =>
          new URL(url).pathname === `/api/uploads/rewards/${missionId}`,
      ),
    ).toHaveLength(1);
  });
});
