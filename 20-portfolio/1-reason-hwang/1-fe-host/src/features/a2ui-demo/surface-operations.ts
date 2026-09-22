import { z } from "zod";

export const surfaceContentSchema = z.object({ a2ui_operations: z.array(z.record(z.unknown())).optional() }).passthrough();
export type Operations = Record<string, unknown>[];

export function surfaceOf(operation: Record<string, unknown>): string | undefined {
  for (const key of ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"]) {
    const value = operation[key];
    if (value && typeof value === "object" && "surfaceId" in value && typeof value.surfaceId === "string") return value.surfaceId;
  }
}

export const isCanvasSurface = (id: string) => id.startsWith("sec-canvas-");
