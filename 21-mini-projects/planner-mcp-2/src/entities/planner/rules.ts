import type { ChecklistItem, Document } from "./model";
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(status, message);
}
export function nextStatus(
  items: ChecklistItem[],
  current: Document["status"],
): Document["status"] {
  if (
    items.length &&
    items.every((i) => i.aiResult === "passed" && i.humanConfirmed)
  )
    return "verified";
  if (current === "reopen") return "reopen";
  return items.some((i) => i.aiResult !== "pending" || i.humanConfirmed)
    ? "in-progress"
    : "draft";
}
export function validateOverview(entries: Document["overview"]) {
  const map = new Map(entries.map((e) => [e.id, e]));
  ensure(map.size === entries.length, "Overview IDs must be unique");
  for (const entry of entries) {
    const visited = new Set([entry.id]);
    let parent = entry.parentId;
    while (parent) {
      ensure(map.has(parent), "Unknown overview parent");
      ensure(!visited.has(parent), "Overview cycle");
      visited.add(parent);
      parent = map.get(parent)!.parentId;
    }
  }
}
