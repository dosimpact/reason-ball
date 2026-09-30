import { z } from "zod";
import { activityResponseSchema } from "./activity";
import { activityDaySchema, demoProgressSource } from "./progress";

export const localActivityRequestSchema = z.object({
  conversationId: z.string().min(1).max(200), requestId: z.uuid(), active: z.boolean(),
}).strict();
export type LocalActivityRequest = z.infer<typeof localActivityRequestSchema>;
export const localActivitySchema = z.object({
  version: z.literal(1),
  days: z.array(activityDaySchema).refine((days) => new Set(days.map((day) => day.date)).size === days.length),
  lastSeenAt: z.number().int().nonnegative().nullable(), active: z.boolean(),
  receipts: z.array(z.object({ request: localActivityRequestSchema, result: activityResponseSchema }).strict()),
}).strict();
export type LocalActivity = z.infer<typeof localActivitySchema>;

function checkedTime(now: number) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) throw new Error("Invalid activity time");
  return now;
}

export function initialLocalActivity(now: number): LocalActivity {
  return { version: 1, days: demoProgressSource(new Date(checkedTime(now)).toISOString().slice(0, 10)).days,
    lastSeenAt: null, active: false, receipts: [] };
}

export function applyLocalActivity(input: LocalActivity, raw: LocalActivityRequest, now: number) {
  const state = localActivitySchema.parse(input);
  const request = localActivityRequestSchema.parse(raw);
  checkedTime(now);
  const previous = state.receipts.find((item) => item.request.requestId === request.requestId);
  if (previous) {
    if (previous.request.conversationId !== request.conversationId || previous.request.active !== request.active) throw new Error("Activity request key reused with different input");
    return { state, result: previous.result };
  }
  let acceptedSeconds = 0;
  if (state.active && state.lastSeenAt !== null && now > state.lastSeenAt && now - state.lastSeenAt <= 45_000) {
    let cursor = Math.floor(state.lastSeenAt / 1000) * 1000;
    const end = Math.floor(now / 1000) * 1000;
    while (cursor < end) {
      const date = new Date(cursor).toISOString().slice(0, 10);
      const nextMidnight = Date.parse(`${date}T00:00:00Z`) + 86_400_000;
      const stop = Math.min(end, nextMidnight);
      const seconds = (stop - cursor) / 1000;
      let day = state.days.find((item) => item.date === date);
      if (!day) { day = { date, minutes: 0, messages: 0, missionsStarted: 0, missionsCompleted: 0 }; state.days.push(day); }
      day.activeSeconds = (day.activeSeconds ?? day.minutes * 60) + seconds;
      day.minutes = Math.floor(day.activeSeconds / 60);
      acceptedSeconds += seconds;
      cursor = stop;
    }
  }
  const result = { acceptedSeconds, recordedAt: new Date(now).toISOString() };
  state.lastSeenAt = now;
  state.active = request.active;
  state.receipts.push({ request, result });
  return { state, result };
}
