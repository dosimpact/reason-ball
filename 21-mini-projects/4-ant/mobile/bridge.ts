export type WebMessage =
  | { v: 1; type: "READY" }
  | { v: 1; type: "REWARDED_HINT"; requestId: string }
  | { v: 1; type: "LEVEL_COMPLETE"; level: number };
export type NativeMessage =
  | { v: 1; type: "PAUSE"; paused: boolean }
  | { v: 1; type: "REWARDED_RESULT"; requestId: string; earned: boolean };
export function parseMessage(raw: string): WebMessage | null {
  if (raw.length > 1024) return null;
  try {
    const x: unknown = JSON.parse(raw);
    if (!x || typeof x !== "object") return null;
    const m = x as Record<string, unknown>;
    if (m.v !== 1) return null;
    if (m.type === "READY") return { v: 1, type: "READY" };
    if (
      m.type === "REWARDED_HINT" &&
      typeof m.requestId === "string" &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(m.requestId)
    )
      return { v: 1, type: m.type, requestId: m.requestId };
    if (
      m.type === "LEVEL_COMPLETE" &&
      Number.isSafeInteger(m.level) &&
      Number(m.level) > 0 &&
      Number(m.level) < 10000
    )
      return { v: 1, type: m.type, level: Number(m.level) };
  } catch {
    /* Invalid bridge input is ignored. */
  }
  return null;
}
export function eventScript(message: NativeMessage): string {
  return `window.dispatchEvent(new CustomEvent('ant:native',{detail:${JSON.stringify(message)}}));true;`;
}
