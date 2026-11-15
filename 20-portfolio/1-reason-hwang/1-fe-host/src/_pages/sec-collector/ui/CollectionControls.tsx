import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { buildCollectionInput } from "../model/collectionInput";
import type { CollectionInput } from "../model/types";
import type { useSecCollector } from "./useSecCollector";
import { controlClass, ErrorNotice, Field, Section } from "./collector-primitives";

export function CollectionControls({ controller: c }: { controller: ReturnType<typeof useSecCollector> }) {
  const [tickers, setTickers] = useState("");
  const [ciks, setCiks] = useState("");
  const [years, setYears] = useState("20");
  const [since, setSince] = useState("");
  const [period, setPeriod] = useState("years");
  const [download, setDownload] = useState(true);
  const [archive, setArchive] = useState(false);
  const [confirmation, setConfirmation] = useState<{ kind: "selected" | "all"; input: CollectionInput; signature: string; names: string[] }>();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const tokens = (value: string) => value.split(/[\s,]+/).filter(Boolean);
  const signature = JSON.stringify({ tickers, ciks, years, since, period, download, archive, selected: c.selected.map(company => company.cik).sort() });
  const validConfirmation = confirmation?.signature === signature;
  useEffect(() => { setConfirmation(undefined); setConfirmed(false); }, [c.selected]);
  function prepare(kind: "selected" | "all") {
    try {
      if (period === "since" && !since) throw new Error("수집 시작일을 입력하세요.");
      if (kind === "all" && period === "since") throw new Error("전체 기업 수집은 조회 기간(년)을 사용합니다.");
      const input = buildCollectionInput(kind, {
        ...(kind === "selected" ? { ciks: [...new Set([...c.selected.map(company => company.cik), ...tokens(ciks)])], tickers: tokens(tickers) } : {}),
        ...(kind === "selected" && period === "since" ? { since } : { years: Number(years) }),
        downloadDocuments: download, refreshArchive: kind === "all" && archive,
      });
      setError(""); setConfirmed(false); setConfirmation({ kind, input, signature, names: c.selected.map(company => `${company.name} (${company.ticker ?? company.cik})`) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "수집 조건을 확인하세요."); }
  }
  return <Section title="수집 실행">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"><div><h3 className="font-medium">기업 목록</h3><p className="text-sm text-muted-foreground">SEC 기업 목록을 먼저 동기화합니다.</p></div><Button disabled={c.busy} onClick={() => void c.execute("directory")}>기업 목록 동기화</Button></div>
    <fieldset disabled={c.busy} onChange={() => { setConfirmation(undefined); setConfirmed(false); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="추가 티커"><input className={controlClass} value={tickers} placeholder="AAPL, MSFT" onChange={event => setTickers(event.target.value)} /></Field>
      <Field label="추가 CIK"><input className={controlClass} value={ciks} placeholder="0000320193" onChange={event => setCiks(event.target.value)} /></Field>
      <Field label="기간 지정 방식"><select className={controlClass} value={period} onChange={event => setPeriod(event.target.value)}><option value="years">최근 N년</option><option value="since">시작일 이후 · 선택 기업 전용</option></select></Field>
      {period === "years" ? <Field label="조회 기간(년)"><input type="number" min={1} max={30} className={controlClass} value={years} onChange={event => setYears(event.target.value)} /></Field> : <Field label="수집 시작일"><input type="date" className={controlClass} value={since} onChange={event => setSince(event.target.value)} /></Field>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={download} onChange={event => setDownload(event.target.checked)} />공시 원문도 서버에 저장</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archive} onChange={event => setArchive(event.target.checked)} />전체 기업 수집 시 SEC ZIP 새로 받기</label>
    </fieldset>
    <p className="my-3 text-sm text-muted-foreground">목록에서 선택한 기업 {c.selected.length}개와 추가 티커·CIK를 함께 사용합니다. 기본값은 최근 20년, 원문 포함입니다.</p>
    <ErrorNotice text={error} />
    <div className="flex flex-wrap gap-2"><Button id="prepare-selected-collection" disabled={c.busy} onClick={() => prepare("selected")}>선택 기업 수집 준비</Button><Button variant="outline" disabled={c.busy} onClick={() => prepare("all")}>전체 기업 수집 준비</Button></div>
    {confirmation && !validConfirmation && <p role="status" className="mt-3 text-sm">수집 조건이 변경되었습니다. 다시 수집을 준비해 주세요.</p>}
    {confirmation && validConfirmation && <div className={`mt-4 rounded-lg border p-4 ${confirmation.kind === "all" ? "border-destructive/50" : "border-border"}`} role="region" aria-label="수집 실행 확인">
      <h3 className="font-semibold">{confirmation.kind === "all" ? "전체 기업 수집 확인" : "선택 기업 수집 확인"}</h3>
      <p className="my-2 text-sm">{confirmation.kind === "all" ? "현재 DB의 티커가 있는 모든 기업을 수집합니다. 장시간 실행될 수 있습니다." : "다음 기업과 기간으로 SEC 수집 API를 실행합니다."}</p>
      <dl className="grid gap-2 rounded bg-muted p-3 text-sm"><div><dt className="font-medium">대상</dt><dd>{confirmation.kind === "all" ? "티커가 있는 전체 기업" : [...confirmation.names, ...(confirmation.input.ciks ?? []).filter(cik => !c.selected.some(company => company.cik === cik)), ...(confirmation.input.tickers ?? [])].join(", ")}</dd></div><div><dt className="font-medium">기간</dt><dd>{confirmation.input.since ? `${confirmation.input.since} 이후` : `최근 ${confirmation.input.years}년`}</dd></div><div><dt className="font-medium">공시 원문</dt><dd>{confirmation.input.downloadDocuments ? "서버에 저장" : "저장하지 않음"}</dd></div><div><dt className="font-medium">SEC ZIP</dt><dd>{confirmation.input.refreshArchive ? "새로 받기" : "기존 캐시 사용"}</dd></div></dl>
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={c.busy} onChange={event => setConfirmed(event.target.checked)} />수집 대상과 기간을 확인했습니다.</label>
      <div className="flex gap-2"><Button disabled={!confirmed || !validConfirmation || c.busy} variant={confirmation.kind === "all" ? "destructive" : "default"} onClick={() => { if (!validConfirmation) return; const task = confirmation; setConfirmation(undefined); void c.execute(task.kind, task.input); }}>수집 시작</Button><Button variant="outline" disabled={c.busy} onClick={() => setConfirmation(undefined)}>돌아가기</Button></div>
    </div>}
    <p className="mt-4 text-xs text-muted-foreground">브라우저 연결을 끊어도 서버 작업이 즉시 취소되었다고 보장할 수 없습니다. 자동 재연결이나 영구 작업 이력은 제공하지 않습니다.</p>
  </Section>;
}
