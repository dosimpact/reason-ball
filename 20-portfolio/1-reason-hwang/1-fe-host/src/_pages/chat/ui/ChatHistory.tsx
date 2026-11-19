"use client";

import { History } from "lucide-react";
import type { ChatHistoryItem } from "../api/chatHistoryApi";

export function ChatHistory({ items, loading, error, disabled, selectedId, onRefresh, onSelect, label = "대화 기록" }: {
  items: ChatHistoryItem[];
  label?: string;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  selectedId: string | null;
  onRefresh: () => Promise<void>;
  onSelect: (threadId: string) => Promise<void>;
}) {
  return <details className="agent-conversation__graph-history" onToggle={event => { if (event.currentTarget.open) void onRefresh(); }}>
    <summary className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <History size={15} aria-hidden="true" />{label}
    </summary>
    <div className="agent-conversation__graph-history-panel">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>선택한 에이전트 · 최근 50개</span>
        <button type="button" className="underline disabled:opacity-50" disabled={loading || disabled} onClick={() => void onRefresh()}>새로고침</button>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">대화 기록을 불러오는 중…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && !items.length && <p className="text-sm text-muted-foreground">저장된 대화가 없습니다.</p>}
      <ul className="space-y-1" aria-label="저장된 대화">
        {items.map(item => <li key={item.threadId}>
          <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            disabled={disabled || loading} aria-current={selectedId === item.threadId ? "true" : undefined}
            onClick={event => {
              const details = event.currentTarget.closest("details");
              void onSelect(item.threadId);
              if (details) details.open = false;
            }}>
            <span className="block truncate">{item.title}{item.status === "busy" ? " · 실행 중" : ""}</span>
            <time dateTime={item.updatedAt} className="text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString("ko-KR")}</time>
          </button>
        </li>)}
      </ul>
    </div>
  </details>;
}
