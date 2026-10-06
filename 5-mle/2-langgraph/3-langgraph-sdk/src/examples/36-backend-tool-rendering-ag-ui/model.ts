import { isPlainObject, isString } from "remeda";
import { z } from "zod";

export type InventoryMetric = {
  label?: string;
  value?: string | number;
};

export type InventoryRow = {
  sku?: string;
  name?: string;
  warehouse?: string;
  available?: string | number;
  reserved?: string | number;
  status?: string;
};

export type InventoryResult = {
  title?: string;
  status?: string;
  summary?: string;
  metrics?: InventoryMetric[];
  rows?: InventoryRow[];
};

export function normalizeInventoryResult(result: unknown): InventoryResult {
  if (isString(result)) {
    try {
      return normalizeInventoryResult(JSON.parse(result));
    } catch {
      return {};
    }
  }

  if (isPlainObject(result)) {
    return result as InventoryResult;
  }

  return {};
}

export const searchInventoryParameters = z.object({
  query: z.string(),
  warehouse: z.string().optional(),
});
