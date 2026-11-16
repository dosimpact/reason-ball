"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RequestLock } from "@/shared/lib/hooks";
import { modelingRequest } from "../api/modelingApi";
import { initialModelingFilters, modelingFilterQuery, mergeEvents, filingPath, isActive, type ModelingFilters, type ModelingOverview, type ExtractionModel, type ModelingEvent, type ModelingFiling, type ModelingRun, type ResultPage, type Stage } from "../model/types";

export function useModeling(execution?: RequestLock<"modeling" | "api-testing">) {
  const [filters, setFilters] = useState<ModelingFilters>(initialModelingFilters);
  const cikFilter = filters.cik;
  const [overview, setOverview] = useState<ModelingOverview>();
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const overviewScope = useRef("");
  const [listError, setListError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailScope = useRef("");
  const listScope = useRef("");
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
  const actionBusy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; actions.current.forEach(controller => controller.abort()); }; }, []);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController(); setOverviewLoading(true); setOverviewError("");
    const scope = JSON.stringify(filters); if (overviewScope.current !== scope) { setOverview(undefined); overviewScope.current = scope; }
    modelingRequest<ModelingOverview>(`overview?${modelingFilterQuery(filters)}`, controller.signal).then(data => { if (!controller.signal.aborted) setOverview(data); }).catch(reason => { if (!controller.signal.aborted) setOverviewError(String(reason.message)); }).finally(() => { if (!controller.signal.aborted) setOverviewLoading(false); });
    return () => controller.abort();
  }, [revision, filters]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setListError("");
    const scope = JSON.stringify([filters, filingPage]);
    if (listScope.current !== scope) { setFilings([]); setFilingTotal(0); listScope.current = scope; }
    modelingRequest<{ items: ModelingFiling[]; total: number }>(`filings?limit=20&offset=${(filingPage - 1) * 20}&${modelingFilterQuery(filters)}`, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setFilings(data.items); setFilingTotal(data.total);
      const last = Math.max(1, Math.ceil(data.total / 20)); if (filingPage > last) setFilingPage(last);
      setSelected(previous => previous ? data.items.find(item => item.cik === previous.cik && item.accessionNo === previous.accessionNo) ?? null : null);
    }).catch(reason => { if (!controller.signal.aborted) setListError(String(reason.message)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, filingPage, filters]);
  useEffect(() => {
    if (!filings.some(filing => Object.values(filing.stages).some(state => isActive(state.latestRun?.status)))) return;
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [filings, refresh]);
  const cik = selected?.cik; const accessionNo = selected?.accessionNo;
  useEffect(() => {
    setDetailError(""); setDetailLoading(false);
    const scope = `${cik}/${accessionNo}/${stage}/${page}`;
    if (detailScope.current !== scope) { setResult(null); setRuns([]); detailScope.current = scope; }
    if (!cik || !accessionNo) return;
    const controller = new AbortController();
    setDetailLoading(true);
    const query = new URLSearchParams({ cik, accessionNo });
    Promise.allSettled([
      modelingRequest<{ items: ModelingRun[] }>(`runs?${query}`, controller.signal),
      modelingRequest<ResultPage>(`${filingPath({ cik, accessionNo })}/results/${stage}?offset=${(page - 1) * 20}&limit=20`, controller.signal),
    ]).then(([history, data]) => {
      if (controller.signal.aborted) return;
      if (history.status === "fulfilled") setRuns(history.value.items);
      if (data.status === "fulfilled") setResult(data.value);
      const failed = [history, data].find(value => value.status === "rejected");
      if (failed?.status === "rejected") setDetailError(String(failed.reason.message));
      setDetailLoading(false);
    });
    return () => controller.abort();
  }, [cik, accessionNo, stage, page, revision]);
  const runId = run?.runId ?? run?.id; const active = isActive(run?.status);
  const currentSelection = useRef(""); currentSelection.current = selected ? `${selected.cik}/${selected.accessionNo}` : "";
  const currentRun = useRef(runId); currentRun.current = runId;
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
    if (actionBusy.current || (execution && !execution.acquire("modeling"))) return;
    actionBusy.current = true;
    const controller = new AbortController(); actions.current.add(controller); setBusy(true); setError("");
    try { const result = await perform(controller.signal); return controller.signal.aborted || !mounted.current ? undefined : result; }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { actionBusy.current = false; actions.current.delete(controller); execution?.release("modeling"); if (mounted.current) setBusy(false); }
  }
  function resetRun() {
    setRun(null); setEvents([]); setHasMoreEvents(false); eventCursor.current = { runId: "", cursor: "0" };
  }
  return {
    filings, filters, overview, overviewLoading, overviewError, listError, detailLoading, detailError, cikFilter,
    applyFilter: (value: string) => { setFilters(previous => ({ ...previous, cik: value.trim() ? value.trim().padStart(10, "0") : "" })); setFilingPage(1); setSelected(null); resetRun(); },
    applyFilters: (value: ModelingFilters) => { setFilters({ ...value, cik: value.cik.trim() ? value.cik.trim().padStart(10, "0") : "", q: value.q.trim() }); setFilingPage(1); setSelected(null); resetRun(); },
    collapse: () => { setSelected(null); resetRun(); }, filingPage, filingTotal, setFilingPage: (value: number) => { setFilingPage(value); setSelected(null); resetRun(); }, selected, runs, run, events, result, stage, page, error, loading, busy: busy || !!execution?.owner, refresh,
    select: (filing: ModelingFiling) => { setSelected(filing); setPage(1); resetRun(); setError(""); },
    changeStage: (value: Stage) => { setStage(value); setPage(1); setError(""); }, setPage,
    inspectRun: (value: ModelingRun) => { resetRun(); setRun(value); setInspection(value => value + 1); },
    start: (value: Stage, extractionModel: ExtractionModel) => action(async signal => {
      if (!selected) return;
      const selectionKey = `${selected.cik}/${selected.accessionNo}`;
      const data = await modelingRequest<{ runId: string; status: string }>(`${filingPath(selected)}/model-${value}/runs`, signal, { extractionModel: value === 3 ? "gpt-6-luna" : extractionModel });
      if (signal.aborted || !mounted.current || currentSelection.current !== selectionKey) return;
      setRun({ ...data, id: data.runId, cik: selected.cik, accessionNo: selected.accessionNo, stage: value, createdAt: new Date().toISOString() }); refresh();
    }),
    mutateRun: (operation: "retry" | "cancel") => action(async signal => {
      if (!runId) return;
      const requestedRun = runId;
      const data = await modelingRequest<ModelingRun>(`runs/${encodeURIComponent(runId)}/${operation}`, signal, {});
      if (signal.aborted || !mounted.current || currentRun.current !== requestedRun) return;
      setRun(previous => previous ?  { ...previous, ...data, id: data.runId ?? previous.id } : data); refresh();
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
