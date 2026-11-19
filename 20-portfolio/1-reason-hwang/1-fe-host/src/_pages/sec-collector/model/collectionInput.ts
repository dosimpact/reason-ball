import type { CollectionInput, CollectionKind } from "./types";

export function buildCollectionInput(kind: CollectionKind, input: CollectionInput): CollectionInput {
  const output: CollectionInput = { downloadDocuments: input.downloadDocuments ?? true, refreshArchive: input.refreshArchive ?? false };
  if (kind === "selected" && input.since !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.since) || !Number.isFinite(Date.parse(input.since)) || new Date(input.since).toISOString().slice(0, 10) !== input.since) throw new Error("시작일을 YYYY-MM-DD 형식으로 입력하세요.");
    output.since = input.since;
  } else {
    const years = input.years ?? 20;
    if (!Number.isInteger(years) || years < 1 || years > 30) throw new Error("수집 기간은 1~30년입니다.");
    output.years = years;
  }
  if (kind === "selected") {
    const ciks = [...new Set((input.ciks ?? []).map(value => value.trim()).filter(Boolean))];
    if (ciks.some(value => !/^\d{1,10}$/.test(value))) throw new Error("CIK는 1~10자리 숫자입니다.");
    const tickers = [...new Set((input.tickers ?? []).map(value => value.trim().toUpperCase()).filter(Boolean))];
    if (!ciks.length && !tickers.length) throw new Error("CIK 또는 티커를 입력하세요.");
    if (ciks.length) output.ciks = ciks.map(value => value.padStart(10, "0"));
    if (tickers.length) output.tickers = tickers;
  }
  return output;
}

export function resetPage<T extends { page: number }>(filters: T, patch: Partial<T>): T {
  return { ...filters, ...patch, page: 1 };
}

/** Consumers compare the captured revision before committing any list response. */
export function createRequestRevision() {
  let revision = 0;
  return { next: () => ++revision, isCurrent: (value: number) => value === revision };
}
