import { expect, test } from "@playwright/test";
import { activityRequestSchema, isRecentLearningActivity } from "../../src/entities/learning-session/model/activity";
import { createActivityRecorder } from "../../src/entities/learning-session/api/activity-recorder";
import { summarizeLearningProgress } from "../../src/entities/learning-session/model/progress";

const conversationId = "58000000-0000-4000-8000-000000000001";
const success = () => Response.json({ activity: { acceptedSeconds: 15, recordedAt: "2026-09-10T00:00:00Z" } });

test("activity requires recent foreground interaction and rejects caller-supplied time or owner", () => {
  const state = { visible: true, focused: true, now: 60_000, lastInteraction: 1 };
  expect(isRecentLearningActivity(state)).toBe(true);
  for (const changed of [{ visible: false }, { focused: false }, { lastInteraction: null }, { lastInteraction: 0 }, { lastInteraction: 60_001 }, { now: NaN }]) expect(isRecentLearningActivity({ ...state, ...changed })).toBe(false);
  const request = { conversationId, requestId: conversationId, active: true };
  expect(activityRequestSchema.safeParse(request).success).toBe(true);
  for (const changed of [{ seconds: 999 }, { userId: conversationId }, { active: "true" }, { requestId: "invalid" }]) expect(activityRequestSchema.safeParse({ ...request, ...changed }).success).toBe(false);
});

test("recorder keeps failed request identity and closes the acknowledged start before remaining idle", async () => {
  const requests: Array<{ requestId: string; active: boolean }> = [];
  const errors: Array<string | undefined> = [];
  let saved = 0;
  const recorder = createActivityRecorder(conversationId, () => { saved++; }, (error) => errors.push(error), async (_url, init) => {
    requests.push(JSON.parse(init!.body as string));
    return requests.length === 1 ? Response.json({}, { status: 503 }) : success();
  });
  await recorder.pulse(false);
  expect(requests).toHaveLength(0);
  await recorder.pulse(true);
  expect(errors[0]).toContain("저장하지 못했어요");
  await recorder.pulse(false);
  expect(requests).toHaveLength(3);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[2].active).toBe(false);
  expect(requests[2].requestId).not.toBe(requests[0].requestId);
  expect(saved).toBe(2);
  expect(errors.at(-1)).toBeUndefined();
  await recorder.pulse(false);
  expect(requests).toHaveLength(3);
});

test("a stop during an in-flight start is serialized rather than lost", async () => {
  let release!: (response: Response) => void;
  const requests: boolean[] = [];
  const recorder = createActivityRecorder(conversationId, () => {}, () => {}, async (_url, init) => {
    requests.push(JSON.parse(init!.body as string).active);
    return requests.length === 1 ? new Promise<Response>((resolve) => { release = resolve; }) : success();
  });
  const first = recorder.pulse(true);
  await recorder.pulse(false);
  expect(requests).toEqual([true]);
  release(success());
  await first;
  expect(requests).toEqual([true, false]);
});

test("malformed responses are not acknowledged and sub-minute activity still counts as a learning day", async () => {
  let saved = 0;
  const errors: Array<string | undefined> = [];
  const recorder = createActivityRecorder(conversationId, () => { saved++; }, (error) => errors.push(error), async () => Response.json({ activity: { acceptedSeconds: 999 } }));
  await recorder.pulse(true);
  expect(saved).toBe(0);
  expect(errors[0]).toBeTruthy();
  expect(summarizeLearningProgress({ today: "2026-09-10", source: "account", expressionCount: 0, days: [
    { date: "2026-09-10", activeSeconds: 15, minutes: 0, messages: 0, missionsStarted: 0, missionsCompleted: 0 },
  ] })).toMatchObject({ streak: 1, recentMinutes: 0 });
});
