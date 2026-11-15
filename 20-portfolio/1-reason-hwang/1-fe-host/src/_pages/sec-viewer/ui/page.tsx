"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { loadDocument, loadFacts, loadViewer, viewerBase, ViewerApiError } from "../api/viewerApi";
import { validFiling, type ViewerFact, type ViewerFactPage, type ViewerMetadata } from "../model/types";
import { SourceFrame } from "./SourceFrame";

const inputClass = "h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm";
const errorText = (error: unknown) => error instanceof ViewerApiError && error.status === 409 ? `${error.message} 문서를 다시 불러오세요.` : error instanceof Error ? error.message : "뷰어를 불러오지 못했습니다.";
const display = (value: unknown) => value === undefined || value === null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
function FactDetails({ fact, onMove }: { fact: ViewerFact; onMove: () => void }) {
  const fields: Record<string, unknown> = { "계정 QName": fact.conceptQName, "계정 이름": fact.localName, "태그 유형": fact.kind, "원문 표시 값": fact.displayText, "원시 값": fact.rawValue, "변환 값": fact.normalizedValue, "변환 상태": fact.normalizationStatus, "기간": fact.period, "단위": fact.unit, "차원": fact.dimensions, "보고 기업": fact.entity, "Context 참조": fact.contextRef, "Unit 참조": fact.unitRef, "Scale · 10의 지수": fact.scale, "Sign · 부호": fact.sign, "Decimals · 정밀도": fact.decimals, "Format · 변환 규칙": fact.format, "Nil · 보고값 없음": fact.isNil ? "예" : "아니요", "원본 태그 ID": fact.sourceElementId, "원문 구간 수": fact.segments.length };
  return <section aria-label="선택 fact 상세" className="mt-4 border-t pt-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Fact 상세 · {fact.factId}</h3><Button variant="outline" disabled={fact.isHidden || !fact.segments.length} onClick={onMove}>원문으로 이동</Button></div>{(fact.isHidden || !fact.segments.length) && <p className="my-2 text-sm text-muted-foreground">숨김 fact 또는 표시 구간이 없는 값입니다. 상세는 확인할 수 있지만 원문으로 이동할 수 없습니다.</p>}<dl className="mt-3 grid gap-3">{Object.entries(fields).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{display(value)}</dd></div>)}</dl>{fact.warnings?.map((warning, index) => <p key={index} className="mt-2 text-sm text-amber-700 dark:text-amber-400">{warning}</p>)}</section>;
}

export default function SecViewerPage() {
  const [cik, setCik] = useState(""); const [accessionNo, setAccessionNo] = useState("");
  const [filing, setFiling] = useState<{ cik: string; accessionNo: string }>();
  const [metadata, setMetadata] = useState<ViewerMetadata>(); const [source, setSource] = useState("");
  const [facts, setFacts] = useState<ViewerFactPage>(); const [selected, setSelected] = useState<ViewerFact>();
  const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0); const [loading, setLoading] = useState(false); const [searching, setSearching] = useState(false);
  const [error, setError] = useState(""); const [searchError, setSearchError] = useState(""); const [warning, setWarning] = useState("");
  const [tab, setTab] = useState("document"); const [moveRevision, setMoveRevision] = useState(0);
  const selection = useRef<AbortController | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const initialCik = params.get("cik") ?? ""; const initialAccession = params.get("accessionNo") ?? "";
    setCik(initialCik); setAccessionNo(initialAccession);
    if (validFiling(initialCik, initialAccession)) setFiling({ cik: initialCik, accessionNo: initialAccession });
    return () => selection.current?.abort();
  }, []);
  useEffect(() => {
    selection.current?.abort(); setMetadata(undefined); setSource(""); setFacts(undefined); setSelected(undefined); setWarning(""); setError(""); setQuery(""); setSearch(""); setPage(1);
    if (!filing) return;
    const controller = new AbortController(); setLoading(true);
    (async () => {
      try { const meta = await loadViewer(filing.cik, filing.accessionNo, controller.signal); if (controller.signal.aborted) return; setMetadata(meta); if (meta.available && meta.isInline && meta.status !== "unsupported") { const html = await loadDocument(filing.cik, filing.accessionNo, meta, controller.signal); if (!controller.signal.aborted) setSource(html); } }
      catch (failure) { if (!controller.signal.aborted) setError(errorText(failure)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [filing, revision]);
  useEffect(() => {
    if (!filing || !metadata?.available || !metadata.isInline || metadata.status === "unsupported") return;
    const controller = new AbortController(); setSearching(true); setSearchError(""); setFacts(undefined);
    loadFacts(filing.cik, filing.accessionNo, metadata, { q: search, page }, controller.signal).then(result => { if (!controller.signal.aborted) setFacts(result); }).catch(failure => { if (!controller.signal.aborted) setSearchError(errorText(failure)); }).finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [filing, metadata, search, page]);
  const inspect = useCallback(async (factId: string) => {
    if (!filing || !metadata) return;
    selection.current?.abort(); const controller = new AbortController(); selection.current = controller;
    try {
      const data = await loadFacts(filing.cik, filing.accessionNo, metadata, { factId }, controller.signal);
      const fact = data.items.find(item => item.factId === factId);
      if (!fact) throw new Error("현재 문서에 없는 fact입니다.");
      if (selection.current === controller && !controller.signal.aborted) { setSelected(fact); setWarning(""); setTab("facts"); }
    } catch (failure) { if (!controller.signal.aborted) setWarning(errorText(failure)); }
  }, [filing, metadata]);
  function open() {
    if (!validFiling(cik, accessionNo)) { setError("CIK는 1~10자리 숫자, 접수번호는 0000320193-26-000001 형식으로 입력하세요."); return; }
    const next = { cik: cik.padStart(10, "0"), accessionNo };
    window.history.replaceState(null, "", `${window.location.pathname}?${new URLSearchParams(next)}`); setFiling(next);
  }
  return <main className="flex min-h-svh min-w-0 flex-col gap-4 p-4 lg:h-dvh lg:min-h-0 lg:p-5" aria-label="SEC iXBRL 뷰어">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">SEC iXBRL 뷰어</h1><p className="text-xs text-muted-foreground">수집한 원문 태그와 보고된 값·기간·단위·차원을 함께 살펴봅니다.</p></div><Link className="text-sm underline" href="/sec-collector">SEC 수집 관리로</Link></header>
    <form className="flex shrink-0 flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); open(); }}><label className="flex min-w-0 flex-1 items-center gap-2 text-sm">CIK<input className={`${inputClass} w-full`} value={cik} onChange={event => setCik(event.target.value)} placeholder="0000320193" /></label><label className="flex min-w-[200px] flex-[2] items-center gap-2 text-sm">접수번호<input className={`${inputClass} w-full`} value={accessionNo} onChange={event => setAccessionNo(event.target.value)} placeholder="0000320193-26-000001" /></label><Button type="submit" disabled={loading}>문서 열기</Button><Button type="button" variant="outline" disabled={!filing || loading} onClick={() => setRevision(value => value + 1)}>다시 불러오기</Button></form>
    {loading && <p role="status" className="text-sm">수집한 문서를 준비하는 중…</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{warning && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>}
    {metadata && <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs"><Badge variant="secondary">{metadata.status}</Badge><span>전체 {metadata.totalFacts} · 원문 표시 {metadata.visibleFacts} · 숨김 {metadata.hiddenFacts}</span><span className="break-all text-muted-foreground">문서 {metadata.sourceHash.slice(0, 12)} · {metadata.extractorVersion}</span>{filing && <a className="underline" href={`${viewerBase(filing.cik, filing.accessionNo)}/content`} target="_blank" rel="noopener noreferrer">저장 원문 별도 열기</a>}</div>}
    {metadata?.warnings?.map((text, index) => <p key={index} className="text-xs text-amber-700 dark:text-amber-400">{text}</p>)}
    {metadata && (!metadata.available || !metadata.isInline || metadata.status === "unsupported") && <p className="rounded-lg border p-4 text-sm">이 공시에서는 지원하는 Inline XBRL 태그를 표시할 수 없습니다. 저장 원문을 확인하거나 다른 수집 공시를 선택하세요.</p>}
    {source && metadata && <><div role="tablist" aria-label="뷰어 패널" className="flex shrink-0 gap-2 lg:hidden"><Button role="tab" aria-selected={tab === "document"} aria-controls="viewer-document" onClick={() => setTab("document")}>원문</Button><Button role="tab" aria-selected={tab === "facts"} aria-controls="viewer-facts" onClick={() => setTab("facts")}>검색·상세</Button></div><div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]"><section id="viewer-document" aria-label="태그가 표시된 원문" className={`${tab === "document" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-lg border lg:flex`}><SourceFrame key={`${metadata.sourceHash}:${metadata.extractorVersion}`} source={source} metadata={metadata} selected={selected} onSelect={factId => void inspect(factId)} onWarning={setWarning} moveRevision={moveRevision} /></section><aside id="viewer-facts" aria-label="Fact 검색과 상세" className={`${tab === "facts" ? "block" : "hidden"} min-h-0 overflow-auto rounded-lg border bg-card p-4 lg:block`}><form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}><input className={`${inputClass} flex-1`} aria-label="Fact 검색" placeholder="계정 이름 또는 원문 값" value={query} onChange={event => setQuery(event.target.value)} /><Button disabled={searching}>검색</Button></form><p className="my-2 text-xs text-muted-foreground">서버 검색 · 페이지당 100개{facts ? ` · 총 ${facts.pagination.totalItems}개` : ""}</p>{searching && <p role="status" className="text-xs">검색 중…</p>}{searchError && <p role="alert" className="text-sm text-destructive">{searchError}</p>}<ul className="grid max-h-[35dvh] gap-1 overflow-auto">{facts?.items.map(fact => <li key={fact.factId}><button type="button" className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted ${selected?.factId === fact.factId ? "border-ring bg-muted" : "border-transparent"}`} aria-pressed={selected?.factId === fact.factId} onClick={() => { selection.current?.abort(); setSelected(fact); setWarning(""); }}><strong className="block break-all">{fact.localName || fact.conceptQName}</strong><span className="block line-clamp-2 break-words">{fact.displayText || fact.rawValue || "보고값 없음"}</span>{fact.isHidden && <span className="text-xs text-muted-foreground">숨김 fact · 위치 이동 불가</span>}</button></li>)}</ul>{facts && !facts.items.length && <p className="my-3 text-sm text-muted-foreground">조건에 맞는 fact가 없습니다.</p>}<div className="mt-3 flex items-center justify-between gap-2 text-xs"><Button variant="outline" disabled={searching || page <= 1} onClick={() => setPage(value => value - 1)}>이전</Button><span>{page} / {Math.max(1, facts?.pagination.totalPages ?? 1)}</span><Button variant="outline" disabled={searching || !facts || page >= facts.pagination.totalPages} onClick={() => setPage(value => value + 1)}>다음</Button></div>{selected ? <FactDetails fact={selected} onMove={() => { setTab("document"); setMoveRevision(value => value + 1); }} /> : <p className="mt-4 text-sm text-muted-foreground">원문 값이나 검색 결과를 선택하면 태그 상세가 나타납니다.</p>}<details className="mt-5 border-t pt-3 text-xs"><summary className="cursor-pointer font-medium">태그 읽기 도움말</summary><p className="mt-2">QName은 네임스페이스를 포함한 계정 이름입니다. 기간은 시점 또는 시작·종료일이고, 단위와 차원은 값의 해석 범위를 나타냅니다.</p><p className="mt-2">Scale·Sign·Format은 원문 표시값을 해석하는 규칙입니다. 지원되지 않는 변환은 임의 계산하지 않으며 원시 값과 경고를 표시합니다. Decimals는 소수점 표시 자릿수와 같지 않을 수 있습니다.</p><p className="mt-2">강조 표시는 같은 fact의 여러 원문 구간에 적용됩니다. 숨김 fact는 목록에만 있을 수 있습니다. 외부 이미지·링크·스크립트는 표시하지 않으므로 원본과 일부 서식이 다를 수 있습니다. 계산 관계·taxonomy 정의 탐색은 제공하지 않습니다.</p></details></aside></div></>}
    {!filing && <p className="rounded-lg border p-4 text-sm text-muted-foreground">SEC 수집 관리의 공시 상세에서 XBRL 보기를 선택하거나 CIK와 접수번호를 입력하세요. 수집·다운로드가 완료된 공시만 지원합니다.</p>}
  </main>;
}
