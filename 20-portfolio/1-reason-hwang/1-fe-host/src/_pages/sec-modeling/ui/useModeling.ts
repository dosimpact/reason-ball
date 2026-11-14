"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { modelingRequest } from "../api/modelingApi";
import { mergeEvents, filingPath, isActive, type ExtractionModel, type ModelingEvent, type ModelingFiling, type ModelingRun, type ResultPage, type Stage } from "../model/types";

export function useModeling() {
  const [cikFilter, setCikFilter] = useState("");
  const [filingPage, setFilingPage] = useState(1);
  const [filingTotal, setFilingTotal] = useState(0);
  const [filings, setFilings] = useState<ModelingFiling[]>([]);
  const [selected, setSelected] = useState<ModelingFiling | null>(null);
  const [runs, setRuns] = useState<ModelingRun[]>([]);
  const [run, setRun] = useState<ModelingRun | null>(null);
  const [events, setEvents] = useState<ModelingEvent[]>([]);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const eventCursor = useRef({ runId: "", cursor: "0" });
  const [inspection, setInspection] = useState(0);
  const [result, setResult] = useState<ResultPage | null>(null);
  const [stage, setStage] = useState<Stage>(1);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const actions = useRef(new Set<AbortController>());
  useEffect(() => () => { actions.current.forEach(controller => controller.abort()); }, []);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    modelingRequest<{ items: ModelingFiling[]; total: number }>(`filings?limit=20&offset=${(filingPage - 1) * 20}${cikFilter ? `&cik=${encodeURIComponent(cikFilter)}` : ""}`, controller.signal).then(data => {
      setFilings(data.items); setFilingTotal(data.total); setSelected(previous => previous ? data.items.find(item => item.cik === previous.cik && item.accessionNo === previous.accessionNo) ?? null : null);
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason.message)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, filingPage, cikFilter]);
  useEffect(() => {
    if (!filings.some(filing => Object.values(filing.stages).some(state => isActive(state.latestRun?.status)))) return;
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [filings, refresh]);
  const cik = selected?.cik; const accessionNo = selected?.accessionNo;
  useEffect(() => {
    setResult(null); setRuns([]);
    if (!cik || !accessionNo) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ cik, accessionNo });
    Promise.allSettled([
      modelingRequest<{ items: ModelingRun[] }>(`runs?${query}`, controller.signal),
      modelingRequest<ResultPage>(`${filingPath({ cik, accessionNo })}/results/${stage}?offset=${(page - 1) * 20}&limit=20`, controller.signal),
    ]).then(([history, data]) => {
      if (controller.signal.aborted) return;
      if (history.status === "fulfilled") setRuns(history.value.items);
      if (data.status === "fulfilled") setResult(data.value);
      const failed = [history, data].find(value => value.status === "rejected");
      if (failed?.status === "rejected") setError(String(failed.reason.message));
    });
    return () => controller.abort();
  }, [cik, accessionNo, stage, page, revision]);
  const runId = run?.runId ?? run?.id; const active = isActive(run?.status);
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let failures = 0;
    if (eventCursor.current.runId !== runId) { eventCursor.current = { runId, cursor: "0" }; setEvents([]); setHasMoreEvents(false); }
    const poll = async () => {
      try {
        const [detail, log] = await Promise.all([
          modelingRequest<ModelingRun>(`runs/${encodeURIComponent(runId)}`, controller.signal),
          modelingRequest<{ items: ModelingEvent[]; nextCursor: string | null }>(`runs/${encodeURIComponent(runId)}/events?cursor=${encodeURIComponent(eventCursor.current.cursor)}`, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        failures = 0; setRun(detail);
        setEvents(previous => mergeEvents(previous, log.items));
        eventCursor.current.cursor = log.nextCursor ?? eventCursor.current.cursor;
        setHasMoreEvents(log.items.length === 100);
        if (isActive(detail.status)) timer = setTimeout(poll, 2000);
        else if (active) refresh();
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        failures += 1;
        if (active && failures < 3) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [runId, active, refresh, inspection]);
  async function action<T>(perform: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    const controller = new AbortController(); actions.current.add(controller); setBusy(true); setError("");
    try { return await perform(controller.signal); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { actions.current.delete(controller); if (!controller.signal.aborted) setBusy(false); }
  }
  function resetRun() {
    setRun(null); setEvents([]); setHasMoreEvents(false); eventCursor.current = { runId: "", cursor: "0" };
  }
  return {
    filings, cikFilter, applyFilter: (value: string) => { setCikFilter(value.trim() ? value.trim().padStart(10, "0") : ""); setFilingPage(1); setSelected(null); resetRun(); }, filingPage, filingTotal, setFilingPage: (value: number) => { setFilingPage(value); setSelected(null); resetRun(); }, selected, runs, run, events, result, stage, page, error, loading, busy, refresh,
    select: (filing: ModelingFiling) => { setSelected(filing); setPage(1); resetRun(); setError(""); },
    changeStage: (value: Stage) => { setStage(value); setPage(1); setError(""); }, setPage,
    inspectRun: (value: ModelingRun) => { resetRun(); setRun(value); setInspection(value => value + 1); },
    start: (value: Stage, extractionModel: ExtractionModel) => action(async signal => {
      if (!selected) return;
      const data = await modelingRequest<{ runId: string; status: string }>(`${filingPath(selected)}/model-${value}/runs`, signal, { extractionModel });
      setRun({ ...data, id: data.runId, cik: selected.cik, accessionNo: selected.accessionNo, stage: value, createdAt: new Date().toISOString() }); refresh();
    }),
    mutateRun: (operation: "retry" | "cancel") => action(async signal => {
      if (!runId) return;
      const data = await modelingRequest<ModelingRun>(`runs/${encodeURIComponent(runId)}/${operation}`, signal, {});
      setRun(previous => previous ? { ...previous, ...data, id: data.runId ?? previous.id } : data); refresh();
    }),
    moreEvents: hasMoreEvents ? () => action(async signal => {
      const requestedRunId = runId;
      const data = await modelingRequest<{ items: ModelingEvent[]; nextCursor: string | null }>(`runs/${encodeURIComponent(runId!)}/events?cursor=${encodeURIComponent(eventCursor.current.cursor)}`, signal);
      if (eventCursor.current.runId !== requestedRunId) return;
      setEvents(previous => mergeEvents(previous, data.items));
      eventCursor.current.cursor = data.nextCursor ?? eventCursor.current.cursor; setHasMoreEvents(data.items.length === 100);
    }) : undefined,
    inspectEvidence: (id: string) => action(signal => modelingRequest<unknown>(`evidence/${encodeURIComponent(id)}`, signal)),
    search: (query: string) => action(signal => modelingRequest<unknown>("search", signal, { query, filingIds: selected ? [`filing:${selected.cik}:${selected.accessionNo}`] : [], topK: 10 })),
  };
}
