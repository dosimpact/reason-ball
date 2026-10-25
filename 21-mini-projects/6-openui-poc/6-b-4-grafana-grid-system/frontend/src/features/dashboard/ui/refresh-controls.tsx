"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Panel } from "@/entities/dashboard";
import { command, useDashboard } from "../model/store";

function dateLabel(value: unknown) {
  if (typeof value !== "string" || !value) return "기록 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
export function RefreshControls({
  panel,
  threadId,
}: {
  panel: Panel;
  threadId: string;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mode = panel.refresh?.mode ?? "live";
  const interval = panel.refresh?.interval_seconds ?? 0;
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const current = useDashboard
      .getState()
      .documents[threadId]?.panels.find((p) => p.id === panel.id);
    if (!current || current.refresh?.mode === "snapshot") return;
    pending.current = true;
    setBusy(true);
    try {
      await command(threadId, "refresh", panel.id);
    } catch {
      /* Store displays the command error. */
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [threadId, panel.id]);
  useEffect(() => {
    if (mode === "snapshot" || !interval) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const current = useDashboard
        .getState()
        .documents[threadId]?.panels.find((p) => p.id === panel.id);
      if (!current) return;
      const last = current.refresh?.last_attempt_at ?? current.data.queried_at;
      const time = typeof last === "string" ? Date.parse(last) : 0;
      if (!Number.isFinite(time) || Date.now() - time >= interval * 1000)
        void refresh();
    };
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, [mode, interval, refresh, threadId, panel.id]);
  const policy = (payload: Record<string, unknown>) => {
    void command(threadId, "refresh_policy", panel.id, payload).catch(() => {});
  };
  return (
    <section
      className="refresh-controls"
      aria-label={`${panel.title} 데이터 갱신`}
    >
      <div>
        <button
          disabled={busy || mode === "snapshot"}
          onClick={() => void refresh()}
        >
          {busy ? "조회 중…" : "지금 새로고침"}
        </button>
        <label>
          상태{" "}
          <select
            aria-label={`${panel.title} 갱신 모드`}
            value={mode}
            onChange={(e) => policy({ mode: e.target.value })}
          >
            <option value="live">Live</option>
            <option value="snapshot">Snapshot</option>
          </select>
        </label>
        <label>
          자동 갱신{" "}
          <select
            aria-label={`${panel.title} 자동 갱신`}
            disabled={mode === "snapshot"}
            value={interval}
            onChange={(e) =>
              policy({ interval_seconds: Number(e.target.value) })
            }
          >
            <option value={0}>끔</option>
            <option value={60}>1분</option>
            <option value={300}>5분</option>
            <option value={900}>15분</option>
          </select>
        </label>
      </div>
      <small>
        마지막 정상 조회:{" "}
        {dateLabel(panel.refresh?.last_success_at ?? panel.data.queried_at)} ·
        최근 공시: {String(panel.data.latest_filing_date || "기록 없음")}
      </small>
      {panel.data.source_fetched_at ? (
        <small>원천 확인: {dateLabel(panel.data.source_fetched_at)}</small>
      ) : null}
      {mode === "snapshot" && (
        <p>
          현재 데이터를 보관합니다. Live로 전환하기 전에는 갱신하지 않습니다.
        </p>
      )}
      {panel.refresh?.error && <p role="alert">{panel.refresh.error}</p>}
    </section>
  );
}
