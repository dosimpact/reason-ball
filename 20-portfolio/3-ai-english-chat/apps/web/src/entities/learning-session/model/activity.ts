import { z } from "zod";

export const activityRequestSchema = z.object({
  conversationId: z.uuid(), requestId: z.uuid(), active: z.boolean(),
}).strict();
export type ActivityRequest = z.infer<typeof activityRequestSchema>;
export const activityResponseSchema = z.object({
  acceptedSeconds: z.number().int().min(0).max(45), recordedAt: z.iso.datetime({ offset: true }),
}).strict();

export function isRecentLearningActivity(input: { visible: boolean; focused: boolean; now: number; lastInteraction: number | null }) {
  return input.visible && input.focused && input.lastInteraction !== null &&
    Number.isFinite(input.now) && Number.isFinite(input.lastInteraction) &&
    input.now >= input.lastInteraction && input.now - input.lastInteraction < 60_000;
}
