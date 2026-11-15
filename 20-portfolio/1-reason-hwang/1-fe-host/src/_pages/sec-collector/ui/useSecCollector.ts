"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecutionLock } from "./useExecutionLock";
import * as api from "../api/secCollectorApi";
import { buildCollectionInput } from "../model/collectionInput";
import { streamCollection, streamFilingDownload } from "../api/collectionStream";
import type { CollectionInput, CollectionOutcome, Company, CompanyListResponse, CompaniesFilters, Filing, FilingsFilters, ListResponse, Overview } from "../model/types";

export const collectorServices = { ...api, streamCollection, streamFilingDownload };
export type CollectorServices = Pick<typeof collectorServices, "fetchCompanies" | "fetchFilings" | "fetchOverview" | "syncCompanies" | "streamCollection" | "streamFilingDownload">;
type Trace = { method: string; url: string; status: number; durationMs: number };
export type SessionRun = { id: string; kind: string; accessionNo?: string; input?: CollectionInput; targetNames?: string[]; startedAt: string; status: "active" | "completed" | "partial" | "error" | "disconnected"; events: { type: string; data: Record<string, unknown> }[]; result?: unknown; message?: string };
const messageOf = (error: unknown) => error instanceof Error ? error.message : "요청에 실패했습니다.";

export function useSecCollector(services: CollectorServices, execution?: ExecutionLock) {
  const [overview, setOverview] = useState<Overview>();
  const [companies, setCompanies] = useState<CompanyListResponse<Company>>();
  const [appliedCompanyFilters, setAppliedCompanyFilters] = useState<CompaniesFilters>();
  const [filings, setFilings] = useState<ListResponse<Filing>>();
  const [companyFilters, setCompanyFilters] = useState<CompaniesFilters>({ page: 1, pageSize: 10 });
  const [filingFilters, setFilingFilters] = useState<FilingsFilters>({ page: 1, pageSize: 10 });
  const [selected, setSelected] = useState<Company[]>([]);
  const [detail, setDetail] = useState<Filing>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const [runs, setRuns] = useState<SessionRun[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [inspection, setInspection] = useState<{ method: string; path: string; args: unknown; response?: unknown }>();
  const [copied, setCopied] = useState(false);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  const onTrace = useCallback((trace: Trace) => { if (mounted.current) setTraces(previous => [...previous.slice(-49), trace]); }, []);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const setError = useCallback((key: string, error?: unknown) => setErrors(previous => ({ ...previous, [key]: error ? messageOf(error) : "" })), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(previous => ({ ...previous, overview: true })); setError("overview");
    services.fetchOverview(controller.signal, onTrace).then(value => { if (!controller.signal.aborted) setOverview(value); }).catch(error => { if (!controller.signal.aborted) setError("overview", error); }).finally(() => { if (!controller.signal.aborted) setLoading(previous => ({ ...previous, overview: false })); });
    return () => controller.abort();
  }, [services, revision, onTrace, setError]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(previous => ({ ...previous, companies: true })); setError("companies");
    services.fetchCompanies(companyFilters, controller.signal, onTrace).then(value => { if (!controller.signal.aborted) { setCompanies(value); setAppliedCompanyFilters(companyFilters); } }).catch(error => { if (!controller.signal.aborted) setError("companies", error); }).finally(() => { if (!controller.signal.aborted) setLoading(previous => ({ ...previous, companies: false })); });
    return () => controller.abort();
  }, [services, companyFilters, revision, onTrace, setError]);
  useEffect(() => {
    if (!filingFilters.cik) { setFilings(undefined); setLoading(previous => ({ ...previous, filings: false })); return; }
    const controller = new AbortController();
    setFilings(undefined);
    setLoading(previous => ({ ...previous, filings: true })); setError("filings");
    services.fetchFilings(filingFilters, controller.signal, onTrace).then(value => { if (!controller.signal.aborted) { setFilings(value); setDetail(previous => previous ? value.items.find(item => item.cik === previous.cik && item.accessionNo === previous.accessionNo) : undefined); } }).catch(error => { if (!controller.signal.aborted) setError("filings", error); }).finally(() => { if (!controller.signal.aborted) setLoading(previous => ({ ...previous, filings: false })); });
    return () => controller.abort();
  }, [services, filingFilters, revision, onTrace, setError]);

  async function execute(kind: "directory" | "selected" | "all", input: CollectionInput = {}) {
    if (active.current) return;
    input = kind === "directory" ? {} : buildCollectionInput(kind, input);
    if (execution && !execution.acquire("collection")) return;
    const controller = new AbortController(); active.current = controller;
    const id = crypto.randomUUID();
    const path = `/api/sec/${kind === "directory" ? "company-sync-jobs" : kind === "selected" ? "company-filing-sync-jobs" : "all-company-filing-sync-jobs"}`;
    setInspection({ method: "POST", path, args: input });
    setRuns(previous => [{ id, kind, input, targetNames: selected.filter(company => input.ciks?.includes(company.cik)).map(company => `${company.name} (${company.ticker ?? "티커 없음"}, ${company.cik})`), startedAt: new Date().toISOString(), status: "active" as const, events: [] }, ...previous].slice(0, 20));
    const update = (change: Partial<SessionRun>) => { if (mounted.current) setRuns(previous => previous.map(run => run.id === id ? { ...run, ...change } : run)); };
    try {
      if (kind === "directory") {
        const result = await services.syncCompanies(controller.signal, onTrace);
        update({ status: "completed", result });
        if (mounted.current) setInspection({ method: "POST", path, args: input, response: result });
      } else {
        const outcome: CollectionOutcome = await services.streamCollection(kind, input, event => {
          if (mounted.current) setRuns(previous => previous.map(run => run.id === id ? { ...run, events: [...run.events.slice(-99), event] } : run));
        }, controller.signal, onTrace);
        update({ status: outcome.status, result: outcome.result, message: outcome.message });
        if (mounted.current) setInspection({ method: "POST", path, args: input, response: outcome });
      }
    } catch (error) { update({ status: "error", message: messageOf(error) }); }
    finally { if (active.current === controller) active.current = null; execution?.release("collection"); if (mounted.current) refresh(); }
  }

  async function executeFilingDownload(filing: Filing) {
    if (active.current || filing.hasContent) return;
    if (execution && !execution.acquire("collection")) return;
    const controller = new AbortController(); active.current = controller;
    const id = crypto.randomUUID();
    const path = `/api/sec/filings/${encodeURIComponent(filing.cik)}/${encodeURIComponent(filing.accessionNo)}/download-jobs`;
    const input = { cik: filing.cik, accessionNo: filing.accessionNo };
    setInspection({ method: "POST", path, args: input });
    setRuns(previous => [{ id, kind: "filing", accessionNo: filing.accessionNo, startedAt: new Date().toISOString(), status: "active" as const, events: [] }, ...previous].slice(0, 20));
    const update = (change: Partial<SessionRun>) => { if (mounted.current) setRuns(previous => previous.map(run => run.id === id ? { ...run, ...change } : run)); };
    try {
      const outcome = await services.streamFilingDownload(filing.cik, filing.accessionNo, event => {
        if (mounted.current) setRuns(previous => previous.map(run => run.id === id ? { ...run, events: [...run.events.slice(-99), event] } : run));
      }, controller.signal, onTrace);
      update({ status: outcome.status, result: outcome.result, message: outcome.message });
      if (mounted.current) setInspection({ method: "POST", path, args: input, response: outcome });
    } catch (error) { update({ status: "error", message: messageOf(error) }); }
    finally { if (active.current === controller) active.current = null; execution?.release("collection"); if (mounted.current) refresh(); }
  }
  async function copyInspection() {
    try { await navigator.clipboard.writeText(JSON.stringify({ request: inspection, http: traces, reads: { overview, companies: { filters: companyFilters, response: companies }, filings: { filters: filingFilters, response: filings } }, errors }, null, 2)); setCopied(true); }
    catch { setCopied(false); setError("copy", new Error("클립보드에 복사할 수 없습니다.")); }
  }
  return { overview, companies, appliedCompanyFilters, filings, companyFilters, filingFilters, setCompanyFilters, setFilingFilters, selected, setSelected, detail, setDetail, errors, loading, runs, inspection, traces, copied, refresh, execute, executeFilingDownload, copyInspection, busy: !!execution?.owner || runs.some(run => run.status === "active") };
}
