export function periodLabel(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const period = value as Record<string, unknown>;
  const instant = period.instantDate ?? period.instant;
  if (typeof instant === "string") return instant;
  const start = period.startDate ?? period.start;
  const end = period.endDate ?? period.end;
  return typeof start === "string" || typeof end === "string" ? `${typeof start === "string" ? start : "—"} ~ ${typeof end === "string" ? end : "—"}` : undefined;
}

export function unitLabel(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (!value.trim().startsWith("{")) return value;
    try { return unitLabel(JSON.parse(value)); } catch { return "단위 형식 확인 필요"; }
  }
  if (!value || typeof value !== "object") return undefined;
  const unit = value as Record<string, unknown>;
  const numerator = Array.isArray(unit.numerator) ? unit.numerator.filter(x => typeof x === "string").join(" × ") : undefined;
  const denominator = Array.isArray(unit.denominator) ? unit.denominator.filter(x => typeof x === "string").join(" × ") : undefined;
  return numerator ? `${numerator}${denominator ? ` / ${denominator}` : ""}` : typeof unit.measure === "string" ? unit.measure : "단위 형식 확인 필요";
}

