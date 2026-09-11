export type EvaluationMessage = { id: string; role: "user" | "assistant"; text: string };
export type SavedEvaluationMessage = {
  id: string;
  client_message_id: string | null;
  author_id: string | null;
  role: string;
  status: string;
  parts: unknown;
};

export class EvaluationTranscriptConflict extends Error {}

/** Match the browser's text-part rendering, without trusting browser content or IDs. */
function savedText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts.flatMap((part: unknown) => {
    if (!part || typeof part !== "object") return [];
    const value = part as { type?: unknown; text?: unknown };
    return value.type === "text" && typeof value.text === "string" ? [value.text] : [];
  }).join("").trim();
}

export function authoritativeEvaluationTranscript(
  saved: readonly SavedEvaluationMessage[],
  supplied: readonly EvaluationMessage[],
  ownerId: string,
): EvaluationMessage[] {
  const conflict = () => { throw new EvaluationTranscriptConflict("저장된 대화가 변경되었어요. 응답이 끝난 뒤 대화를 새로고침하고 다시 평가해 주세요."); };
  // The API accepts at most 200 messages. Never evaluate an implicitly truncated history.
  if (saved.length > 200 || saved.some((row) => row.status === "pending" || row.status === "streaming")) conflict();
  if (saved.some((row) => row.role === "user" && row.author_id !== ownerId)) conflict();
  const eligible = saved.flatMap((row) => {
    if (row.role !== "user" && row.role !== "assistant") return [];
    // A stopped/failed assistant's persisted partial text is still displayed by the UI.
    // It is context only: downstream evidence accepts complete learner messages exclusively.
    const storedPartial = row.role === "assistant" && (row.status === "cancelled" || row.status === "error");
    if (row.status !== "complete" && !storedPartial) return [];
    const text = savedText(row.parts);
    return text ? [{ row, message: { id: row.id, role: row.role, text } as EvaluationMessage }] : [];
  });
  if (eligible.length < 2 || !eligible.some(({ message }) => message.role === "user") || eligible.length !== supplied.length) conflict();
  if (new Set(supplied.map((message) => message.id)).size !== supplied.length) conflict();
  for (const [index, { row, message }] of eligible.entries()) {
    const input = supplied[index];
    // Current live user messages use their client UUID; restored/legacy rows may use the DB UUID.
    if ((input.id !== row.id && input.id !== row.client_message_id) || input.role !== message.role || input.text.trim() !== message.text) conflict();
  }
  return eligible.map(({ message }) => message);
}
