import { z } from "zod";

export const goalTrackingContextSchema = z.object({
  runId: z.uuid(), versionId: z.uuid(), userMessageId: z.uuid(),
  steps: z.array(z.object({ id: z.uuid(), order: z.number().int(), title: z.string(), objective: z.string(), learnerGoal: z.string(), criteria: z.unknown(), optional: z.boolean() })).min(1),
  messages: z.array(z.object({ id: z.uuid(), role: z.enum(["user", "assistant"]), text: z.string() })),
});
export const generatedGoalTrackingSchema = z.object({ steps: z.array(z.object({
  stepId: z.uuid(), completed: z.boolean(), evidenceMessageIds: z.array(z.uuid()).max(12), feedback: z.string().trim().min(1).max(600),
}).strict()).max(100) }).strict();
export type GoalTrackingContext = z.infer<typeof goalTrackingContextSchema>;
export type TrackedGoal = z.infer<typeof generatedGoalTrackingSchema>["steps"][number];

export function materializeTrackedGoals(context: GoalTrackingContext, input: unknown): TrackedGoal[] {
  const { steps } = generatedGoalTrackingSchema.parse(input);
  const learnerIds = new Set(context.messages.filter((message) => message.role === "user" && message.text.trim()).map((message) => message.id));
  if (steps.length !== context.steps.length || new Set(steps.map((step) => step.stepId)).size !== steps.length) throw new Error("Goal tracking must cover every pinned step exactly once.");
  return context.steps.map((definition) => {
    const step = steps.find((candidate) => candidate.stepId === definition.id);
    if (!step || step.evidenceMessageIds.some((id) => !learnerIds.has(id)) || (step.completed && step.evidenceMessageIds.length === 0)) throw new Error("Goal tracking requires actual learner evidence for pinned steps.");
    return { ...step, evidenceMessageIds: [...new Set(step.evidenceMessageIds)] };
  });
}

export function trackedGoalInstructions(context: GoalTrackingContext, steps: readonly TrackedGoal[]) {
  const remaining = context.steps.filter((definition) => !definition.optional && !steps.some((step) => step.stepId === definition.id && step.completed));
  const progress = JSON.stringify({ completed: context.steps.filter((definition) => steps.some((step) => step.stepId === definition.id && step.completed)).map((step) => step.title), remaining: remaining.map((step) => ({ title: step.title, objective: step.objective })) }).replaceAll("<", "\\u003c");
  return `\nServer-verified practice progress follows as data: ${progress}\n${remaining.length ? "Continue the roleplay naturally toward the next remaining required objective. Recognize goals already achieved even if completed out of order; do not repeatedly ask the learner to redo them." : "The learner has now demonstrated every required objective. Naturally conclude this roleplay transaction in character with a short acknowledgement and farewell; do not introduce another required task or continuation question. Explain briefly that the learner may use the mission evaluation button to review the result. This is practice progress, not a final pass: never announce a score, earned reward, XP or final evaluation."}`;
}
