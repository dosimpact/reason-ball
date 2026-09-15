import { canonicalJson } from "@/shared/lib/json";

export type Difference = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

/** JSON Pointer paths; array positions deliberately preserve ordering. */
export function compareJson(before: unknown, after: unknown): Difference[] {
  const result: Difference[] = [];
  const visit = (left: unknown, right: unknown, path: string) => {
    if (canonicalJson(left) === canonicalJson(right)) return;
    if (left === undefined || right === undefined) {
      result.push({
        path: path || "/",
        kind: left === undefined ? "added" : "removed",
        ...(left === undefined ? {} : { before: left }),
        ...(right === undefined ? {} : { after: right }),
      });
    } else if (
      left &&
      right &&
      typeof left === "object" &&
      typeof right === "object" &&
      Array.isArray(left) === Array.isArray(right)
    ) {
      const a = left as Record<string, unknown>,
        b = right as Record<string, unknown>;
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const own = (value: Record<string, unknown>) =>
          Object.hasOwn(value, key) ? value[key] : undefined;
        visit(
          own(a),
          own(b),
          `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
        );
      }
    } else
      result.push({
        path: path || "/",
        kind: "changed",
        before: left,
        after: right,
      });
  };
  visit(before, after, "");
  return result;
}
