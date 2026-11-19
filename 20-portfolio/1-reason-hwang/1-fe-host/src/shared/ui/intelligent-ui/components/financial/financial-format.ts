const colors = ["#e79b19", "#8b5cf6", "#3b82f6", "#e0528b", "#16a085", "#d35400", "#78909c"];
export const colorFor = (id: string) => colors[[...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % colors.length];
export const numberText = (value: number | null | undefined) => value == null ? "값 없음" : value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
export const parametersText = (parameters: Record<string, unknown>) => Object.entries(parameters).map(([key, value]) => `${key}=${String(value)}`).join(", ");
