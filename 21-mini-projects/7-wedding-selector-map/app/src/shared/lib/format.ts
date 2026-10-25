export function money(value: number | null | undefined, suffix = "원") {
  if (value == null) return "공시가 확인 필요";
  if (value === 0) return "무료";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value / 10000)}만${suffix}`;
}
export function number(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}
