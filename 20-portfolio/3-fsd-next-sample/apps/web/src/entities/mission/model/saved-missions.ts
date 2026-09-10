import { z } from "zod";

export const savedMissionRequestSchema = z.object({
  requestId: z.uuid(), missionId: z.string().trim().min(1).max(200), saved: z.boolean(),
}).strict();
export type SavedMissionRequest = z.infer<typeof savedMissionRequestSchema>;
export const savedMissionResultSchema = z.object({ missionId: z.string().min(1).max(200), saved: z.boolean() }).strict();
export const savedMissionItemSchema = z.object({
  missionId: z.string().min(1).max(200), savedAt: z.iso.datetime(),
  mission: z.object({ id: z.string().min(1).max(200), title: z.string().min(1), summary: z.string() }).strict().nullable(),
}).strict().refine((item) => item.mission === null || item.mission.id === item.missionId);
export const savedMissionListSchema = z.array(savedMissionItemSchema).refine((items) => new Set(items.map((item) => item.missionId)).size === items.length);
export type SavedMissionItem = z.infer<typeof savedMissionItemSchema>;

export const localSavedMissionsSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.object({ missionId: z.string().min(1).max(200), savedAt: z.iso.datetime() }).strict()),
  receipts: z.array(z.object({ request: savedMissionRequestSchema, result: savedMissionResultSchema }).strict()),
}).strict().superRefine((state, context) => {
  if (new Set(state.entries.map((entry) => entry.missionId)).size !== state.entries.length
    || new Set(state.receipts.map((receipt) => receipt.request.requestId)).size !== state.receipts.length
    || state.receipts.some(({ request, result }) => request.missionId !== result.missionId || request.saved !== result.saved)) {
    context.addIssue({ code: "custom", message: "저장 미션 기록이 올바르지 않아요." });
  }
});
export type LocalSavedMissions = z.infer<typeof localSavedMissionsSchema>;

export function setSavedMission(input: LocalSavedMissions, raw: SavedMissionRequest, savedAt: string) {
  const state = localSavedMissionsSchema.parse(input);
  const request = savedMissionRequestSchema.parse(raw);
  z.iso.datetime().parse(savedAt);
  const previous = state.receipts.find((receipt) => receipt.request.requestId === request.requestId);
  if (previous) {
    if (previous.request.missionId !== request.missionId || previous.request.saved !== request.saved) throw new Error("같은 요청 키로 다른 저장 상태를 적용할 수 없어요.");
    return { state, result: previous.result, replayed: true };
  }
  if (!request.saved) state.entries = state.entries.filter((entry) => entry.missionId !== request.missionId);
  else if (!state.entries.some((entry) => entry.missionId === request.missionId)) state.entries.push({ missionId: request.missionId, savedAt });
  const result = { missionId: request.missionId, saved: request.saved };
  state.receipts.push({ request, result });
  return { state, result, replayed: false };
}
