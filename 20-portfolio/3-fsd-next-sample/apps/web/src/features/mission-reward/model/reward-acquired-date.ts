const acquiredDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

/** A persisted unlock instant, rendered consistently across browser time zones. */
export function formatRewardAcquiredDate(unlockedAt: string): string | null {
  const instant = new Date(unlockedAt);
  if (!unlockedAt.trim() || !Number.isFinite(instant.getTime())) return null;
  const parts = acquiredDate.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part("year")}. ${part("month")}. ${part("day")}. (한국 시간)`;
}
