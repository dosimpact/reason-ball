export type Step = { id: string; title: string; status: "running" | "completed" | "failed" | "cancelled" };
export type Turn = { id: string; messageId?: string; question: string; answer: string; steps: Step[]; status: "running" | "completed" | "failed" | "cancelled"; error?: string };
export type StreamEvent = { event: string; data: Record<string, unknown> };

export function applyEvent(turn: Turn, { event, data }: StreamEvent): Turn {
  if (event === "start") return { ...turn, messageId: String(data.message_id) };
  if (event === "ui") {
    const metadata = data.metadata as { message_id?: string } | undefined;
    if (metadata?.message_id !== turn.messageId || data.name !== "turn_progress") return turn;
    const props = data.props as { title: string; status: Step["status"] };
    const step = { id: String(data.id), ...props };
    const existing = turn.steps.findIndex((item) => item.id === step.id);
    return { ...turn, steps: existing < 0 ? [...turn.steps, step] : turn.steps.map((item, i) => i === existing ? { ...item, ...step } : item) };
  }
  if (data.message_id !== turn.messageId) return turn;
  if (event === "answer") return { ...turn, answer: String(data.content) };
  if (event === "done") return { ...turn, status: "completed" };
  if (event === "error") return finishTurn(turn, "failed", String(data.message));
  return turn;
}

export function finishTurn(turn: Turn, status: "failed" | "cancelled", error: string): Turn {
  return { ...turn, status, error, steps: turn.steps.map((step) => step.status === "running" ? { ...step, status } : step) };
}
