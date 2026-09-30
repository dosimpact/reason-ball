/** Input is already ordered and includes at most one look-ahead row. */
export function cursorPage<T, C extends string | number>(rows: readonly T[], limit: number, cursorOf: (item: T) => C) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new RangeError("Page limit must be between 1 and 200.");
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return { items, hasMore, nextCursor: hasMore ? cursorOf(items[items.length - 1]) : null };
}
