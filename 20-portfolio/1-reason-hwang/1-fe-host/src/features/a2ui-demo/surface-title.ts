import { surfaceOf, type Operations } from "./surface-operations";

/** SEC publishes full validated trees; removed components must not label a new result. */
export function secSurfaceTitle(surfaceId: string, batches: Operations[], historical: boolean): string {
  const latest = batches.flatMap(operations => operations.filter(operation => surfaceOf(operation) === surfaceId))
    .map(operation => operation.updateComponents as { components?: { id: string; text?: string; title?: string }[] } | undefined)
    .filter(Boolean).at(-1);
  const components = latest?.components ?? [];
  const stage = components.find(item => item.id === "stage")?.text ?? "SEC 조회";
  const company = components.find(item => item.id === "selected-company")?.text
    ?? components.find(item => item.id === "company-row-0")?.title;
  return company ? `${company}${historical ? ` · ${stage}` : ""}` : stage;
}
