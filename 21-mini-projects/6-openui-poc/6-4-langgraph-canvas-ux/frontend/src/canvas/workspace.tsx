"use client";
import "@openuidev/react-ui/styles/index.css";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import {
  Plus,
  Send,
  Square,
  GripVertical,
  Trash2,
  RefreshCw,
  Pencil,
  Check,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Download,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useCanvas, refreshWidget, stopRefreshes } from "./store";
import {
  clampLayout,
  widgetSchema,
  snapshotSchema,
  type Widget,
  type Command,
} from "./model";
import { DataTable, WidgetRenderer, validateProgram } from "./render";
import { readFrames, type Frame } from "./stream";
import "./workspace.css";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts: Widget[];
  status?: "running" | "complete" | "failed" | "cancelled";
  sources?: Record<string, string>;
  retryOperations?: Record<string, unknown>[];
  retryPrompt?: string;
  completedWidgets?: string[];
};
type Thread = { id: string; title: string; messages: Message[] };
type Draft = {
  id: string;
  canvasId?: string;
  title: string;
  program: string;
  baseRevision: number;
  status: "running" | "failed" | "cancelled";
  error?: string;
};
const CHAT_KEY = "canvas64:threads:v1";
const MIME = "application/x-canvas64";
const periods = [
  { value: "this_month", label: "이번 달" },
  { value: "last_month", label: "지난달" },
  { value: "last_3_months", label: "최근 3개월" },
  { value: "last_6_months", label: "최근 6개월" },
  { value: "last_12_months", label: "최근 12개월" },
];
const starters = [
  "지난달 매출을 채팅에 차트로 보여줘",
  "매출과 광고비 차트를 Canvas에 각각 만들어줘",
  "한국 지역의 월별 매출과 광고비를 비교해줘",
];
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Freshness({ widget }: { widget: Widget }) {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const s = widget.snapshot;
  if (!s) return null;
  const stale = clock > Date.parse(s.expiresAt);
  return (
    <div className="freshness">
      <span className="synthetic">합성 데이터 · 기준 통화 USD · UTC</span>
      {stale && widget.refreshPolicy !== "snapshot" && (
        <span className="stale-explanation">조회 결과가 오래됨</span>
      )}
      <span>조회 {new Date(s.fetchedAt).toLocaleTimeString("ko-KR")}</span>
      <span>
        원천 {s.sourceWatermark.throughDate}까지 · v{s.sourceWatermark.revision}
      </span>
      <span>
        표시 기준 {s.resolvedRange.region} · {s.resolvedRange.start_date} ~{" "}
        {s.resolvedRange.end_date}
      </span>
      {s.truncated && <span>결과 500행 제한</span>}
    </div>
  );
}

function CanvasCard({
  widget,
  draft,
  onPrompt,
  onRemove,
  onDrop,
  onResize,
}: {
  widget: Widget;
  draft?: Draft;
  onPrompt: (text: string) => void;
  onRemove: () => void;
  onDrop: (event: DragEvent, index?: number) => void;
  onResize: (event: PointerEvent<HTMLButtonElement>, widget: Widget) => void;
}) {
  const dispatch = useCanvas((s) => s.dispatch);
  const selected = useCanvas((s) => s.doc.selectedWidgetId === widget.id);
  const runtime = useCanvas((s) => s.runtime[widget.id]);
  const [showData, setShowData] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const onState = useCallback(
    (state: Record<string, unknown>) => {
      const current = useCanvas.getState().doc.widgets[widget.id];
      if (current && JSON.stringify(current.uiState) !== JSON.stringify(state))
        dispatch({ type: "uiState", id: widget.id, value: state });
    },
    [dispatch, widget.id],
  );
  const filter = async (key: string, value: string) => {
    const current = useCanvas.getState().doc.widgets[widget.id];
    const parameters = { ...current.parameters, [key]: value };
    if (parameters.period !== "custom") {
      delete parameters.startDate;
      delete parameters.endDate;
    }
    dispatch({
      type: "replace",
      widget: {
        ...current,
        parameters,
        definitionRevision: current.definitionRevision + 1,
      },
      baseRevision: current.definitionRevision,
    });
    await refreshWidget(widget.id);
  };
  const commitTitle = () => {
    if (!title?.trim()) {
      setTitle(null);
      return;
    }
    onPrompt(
      `선택한 차트(id: ${widget.id})의 제목을 ${JSON.stringify(title.trim())}로 바꿔줘`,
    );
    setTitle(null);
  };
  return (
    <article
      className={`canvas-card ${selected ? "selected" : ""}`}
      style={{
        gridColumn: `span ${widget.layout.w}`,
        gridRow: `span ${widget.layout.h}`,
      }}
      onClick={() => dispatch({ type: "select", id: widget.id })}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        const doc = useCanvas.getState().doc;
        const c = doc.canvases.find((c) => c.id === widget.canvasId);
        onDrop(e, c?.widgetIds.indexOf(widget.id));
      }}
      data-testid="canvas-item"
      data-widget-id={widget.id}
      data-grid-w={widget.layout.w}
      data-grid-h={widget.layout.h}
    >
      <header className="card-toolbar">
        <button
          className="drag-handle"
          title="위젯 이동"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              MIME,
              JSON.stringify({ source: "canvas", id: widget.id }),
            );
            e.dataTransfer.effectAllowed = "move";
          }}
        >
          <GripVertical size={15} />
        </button>
        {title !== null ? (
          <>
            <input
              aria-label="위젯 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") setTitle(null);
              }}
            />
            <button aria-label="제목 저장" onClick={commitTitle}>
              <Check size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="card-label">{widget.title}</span>
            <button title="제목 변경" onClick={() => setTitle(widget.title)}>
              <Pencil size={13} />
            </button>
          </>
        )}
        {widget.queryId && (
          <button
            title="이 위젯 새로고침"
            aria-label={`${widget.title} 새로고침`}
            disabled={runtime?.status === "loading"}
            onClick={() => void refreshWidget(widget.id)}
          >
            <RefreshCw
              size={14}
              className={runtime?.status === "loading" ? "spin" : ""}
            />
          </button>
        )}
        <button
          title="위젯 삭제"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={15} />
        </button>
      </header>
      {widget.queryId && (
        <div className="card-filters">
          <select
            aria-label={`${widget.title} 지역`}
            value={widget.parameters?.region ?? "ALL"}
            onChange={(e) => void filter("region", e.target.value)}
          >
            <option value="ALL">모든 지역</option>
            <option value="KR">한국</option>
            <option value="US">미국</option>
            <option value="JP">일본</option>
          </select>
          <select
            aria-label={`${widget.title} 기간`}
            value={widget.parameters?.period ?? "last_3_months"}
            onChange={(e) => void filter("period", e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            {widget.parameters?.period === "custom" && (
              <option value="custom">지정 기간</option>
            )}
          </select>
          <select
            aria-label={`${widget.title} 갱신 정책`}
            value={widget.refreshPolicy}
            onChange={(e) =>
              dispatch({
                type: "policy",
                id: widget.id,
                policy: e.target.value as Widget["refreshPolicy"],
              })
            }
          >
            <option value="manual">수동 갱신</option>
            <option value="polling">1분마다 갱신</option>
            <option value="snapshot">현재 값 보관</option>
          </select>
        </div>
      )}
      <div className="card-body">
        <WidgetRenderer widget={widget} onState={onState} onPrompt={onPrompt} />
        {showData && widget.snapshot && (
          <DataTable snapshot={widget.snapshot} />
        )}
      </div>
      <div className="card-status" aria-live="polite">
        {draft?.status === "running"
          ? "수정 중 · 기존 결과 표시"
          : (draft?.error ??
            (draft?.status === "cancelled"
              ? "수정 중단 · 기존 결과 유지"
              : ""))}
        {runtime?.status === "error" && (
          <span className="error-text">
            {runtime.error} · 마지막 정상값 유지
          </span>
        )}
        {runtime?.status === "loading" && <span>데이터 갱신 중</span>}
      </div>
      <footer>
        <Freshness widget={widget} />
        {widget.snapshot && (
          <button
            className="text-button"
            onClick={() => setShowData(!showData)}
          >
            {showData ? "표 닫기" : "데이터 보기"}
          </button>
        )}
      </footer>
      <button
        className="resize-handle"
        aria-label={`${widget.title} 크기 조절`}
        onPointerDown={(e) => onResize(e, widget)}
        onKeyDown={(e) => {
          const dw =
            e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          const dh = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
          if (dw || dh) {
            e.preventDefault();
            dispatch({
              type: "layout",
              id: widget.id,
              w: widget.layout.w + dw,
              h: widget.layout.h + dh,
            });
          }
        }}
      >
        ↘
      </button>
    </article>
  );
}

export default function Workspace() {
  const { doc, dispatch, loaded, error, recoveryRaw } = useCanvas();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [chatDrafts, setChatDrafts] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [rename, setRename] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<{
    label: string;
    command: Command;
  } | null>(null);
  const [showThreads, setShowThreads] = useState(false);
  const [dark, setDark] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);
  const activeCanvas = doc.canvases.find((c) => c.id === doc.activeCanvasId);
  const messages = threads.find((t) => t.id === threadId)?.messages ?? [];

  useEffect(() => {
    useCanvas.getState().hydrate();
    try {
      const raw = JSON.parse(
        localStorage.getItem(CHAT_KEY) ?? "[]",
      ) as Thread[];
      const saved = raw.map((t) => ({
        ...t,
        messages: t.messages.map((m) => ({
          ...m,
          status: m.status === "running" ? ("cancelled" as const) : m.status,
        })),
      }));
      if (saved.length) {
        setThreads(saved);
        setThreadId(saved[0].id);
      } else {
        const id = crypto.randomUUID();
        setThreads([{ id, title: "새 대화", messages: [] }]);
        setThreadId(id);
      }
    } catch {
      const id = crypto.randomUUID();
      setThreads([{ id, title: "새 대화", messages: [] }]);
      setThreadId(id);
    }
    try {
      setDark(localStorage.getItem("canvas64:theme") === "dark");
    } catch {}
    return () => {
      abortRef.current?.abort();
      stopRefreshes();
      resizeCleanup.current?.();
    };
  }, []);
  useEffect(() => {
    if (threads.length)
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(threads.slice(0, 30)));
      } catch {
        useCanvas.getState().setError("대화 기록을 저장하지 못했습니다.");
      }
  }, [threads]);
  useEffect(() => {
    document.documentElement.dataset.openuiTheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("canvas64:theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, progress]);
  useEffect(() => {
    const next = new Map<string, number>();
    const tick = setInterval(() => {
      if (document.hidden || !navigator.onLine) return;
      const state = useCanvas.getState();
      const time = Date.now();
      for (const widget of Object.values(state.doc.widgets)) {
        if (
          widget.refreshPolicy !== "polling" ||
          widget.canvasId !== state.doc.activeCanvasId
        )
          continue;
        if (!next.has(widget.id)) next.set(widget.id, time + 60000);
        if (time >= next.get(widget.id)!) {
          next.set(
            widget.id,
            time +
              (state.runtime[widget.id]?.status === "error" ? 120000 : 60000),
          );
          void refreshWidget(widget.id);
        }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const updateMessage = (id: string, fn: (m: Message) => Message) =>
    setThreads((ts) =>
      ts.map((t) =>
        t.id === threadId
          ? { ...t, messages: t.messages.map((m) => (m.id === id ? fn(m) : m)) }
          : t,
      ),
    );
  const addPreview = (widget: Widget, canvasId?: string) => {
    let target = canvasId || useCanvas.getState().doc.activeCanvasId;
    if (!target) {
      target = crypto.randomUUID();
      dispatch({ type: "createCanvas", id: target, title: "새 Canvas" });
    }
    const cloned = structuredClone(widget);
    cloned.id = crypto.randomUUID();
    cloned.canvasId = target;
    dispatch({ type: "add", canvasId: target, widget: cloned });
  };
  const applyOperation = (operation: Record<string, unknown>) => {
    const id = String(operation.targetId ?? "");
    const canvasId = String(operation.canvasId ?? operation.targetId ?? "");
    const title = String(operation.title ?? "새 Canvas");
    switch (operation.action) {
      case "create_canvas":
        dispatch({ type: "createCanvas", id: crypto.randomUUID(), title });
        break;
      case "rename_canvas":
        dispatch({ type: "renameCanvas", id: canvasId, title });
        break;
      case "select_canvas":
        dispatch({ type: "selectCanvas", id: canvasId });
        break;
      case "reorder_canvas":
        dispatch({
          type: "reorderCanvas",
          id: canvasId,
          index: Number(operation.index ?? 0),
        });
        break;
      case "delete_canvas":
        setConfirmation({
          label: "이 Canvas와 위젯을 삭제할까요?",
          command: { type: "removeCanvas", id: canvasId },
        });
        break;
      case "clear_canvas":
        setConfirmation({
          label: "Canvas를 비울까요?",
          command: { type: "clearCanvas", id: canvasId },
        });
        break;
      case "remove":
        dispatch({ type: "remove", id });
        break;
      case "move":
        dispatch({ type: "move", id, canvasId });
        break;
      case "reorder": {
        const w = useCanvas.getState().doc.widgets[id];
        if (w?.canvasId)
          dispatch({
            type: "move",
            id,
            canvasId: w.canvasId,
            index: Number(operation.index ?? 0),
          });
        break;
      }
      case "policy":
        dispatch({
          type: "policy",
          id,
          policy: operation.refreshPolicy as Widget["refreshPolicy"],
        });
        break;
    }
  };
  const send = async (
    text = input,
    retryOperations?: Record<string, unknown>[],
  ) => {
    text = text.trim();
    if (!text || running || !loaded) return;
    setInput("");
    setChatDrafts({});
    if (retryOperations?.length)
      setDrafts((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([, draft]) => draft.status === "running",
          ),
        ),
      );
    setRunning(true);
    setProgress("요청을 보내는 중입니다.");
    const controller = new AbortController();
    abortRef.current = controller;
    const messageId = crypto.randomUUID();
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      artifacts: [],
    };
    const captured = useCanvas.getState().doc;
    const sources = Object.fromEntries(
      Object.values(captured.widgets)
        .filter((w) => w.snapshot)
        .map((w) => [w.id, w.snapshot!.dataVersion]),
    );
    setThreads((ts) =>
      ts.map((t) =>
        t.id === threadId
          ? {
              ...t,
              title: t.messages.length ? t.title : text.slice(0, 35),
              messages: [
                ...t.messages,
                user,
                {
                  id: messageId,
                  role: "assistant",
                  content: "",
                  artifacts: [],
                  status: "running",
                  retryPrompt: text,
                  sources,
                },
              ],
            }
          : t,
      ),
    );
    const localDrafts: Record<string, Draft> = {};
    const receive = (frame: Frame) => {
      if (controller.signal.aborted) return;
      const id = frame.widgetId ?? "";
      if (frame.type === "progress") setProgress(String(frame.message));
      if (frame.type === "tool")
        setProgress(
          `${String(frame.name)} · ${frame.status === "complete" ? "완료" : "실행 중"}`,
        );
      if (frame.type === "message")
        updateMessage(messageId, (m) => ({
          ...m,
          content: m.content + String(frame.text),
        }));
      if (frame.type === "start") {
        localDrafts[id] = {
          id,
          title: String(frame.title),
          canvasId: frame.canvasId as string,
          program: "",
          baseRevision: Number(frame.baseRevision),
          status: "running",
        };
        if (frame.channel === "canvas")
          setDrafts((d) => ({ ...d, [id]: localDrafts[id] }));
        else setChatDrafts((d) => ({ ...d, [id]: localDrafts[id] }));
        setProgress(`${String(frame.title)} 생성 중`);
      }
      if (frame.type === "delta" && localDrafts[id]) {
        localDrafts[id] = {
          ...localDrafts[id],
          program: localDrafts[id].program + String(frame.delta),
        };
        if (frame.channel === "canvas")
          setDrafts((d) => ({ ...d, [id]: localDrafts[id] }));
        else setChatDrafts((d) => ({ ...d, [id]: localDrafts[id] }));
      }
      if (frame.type === "complete" || frame.type === "refreshed") {
        try {
          const widget = widgetSchema.parse(frame.widget);
          validateProgram(widget.program);
          if (frame.channel === "chat")
            updateMessage(messageId, (m) => ({
              ...m,
              artifacts: [
                ...m.artifacts.filter((w) => w.id !== widget.id),
                widget,
              ],
            }));
          else {
            const existing = useCanvas.getState().doc.widgets[widget.id];
            if (
              existing &&
              existing.definitionRevision !== Number(frame.baseRevision)
            )
              throw new Error(
                "이전 요청의 결과를 적용하지 않았습니다. 최신 조건으로 다시 요청하세요.",
              );
            if (existing)
              dispatch({
                type: "replace",
                widget,
                baseRevision: Number(frame.baseRevision),
              });
            else if (Number(frame.baseRevision ?? 0) === 0 && widget.canvasId)
              dispatch({ type: "add", widget, canvasId: widget.canvasId });
            else throw new Error("수정 중 대상 위젯이 삭제되었습니다.");
          }
          updateMessage(messageId, (m) => ({
            ...m,
            completedWidgets: [...(m.completedWidgets ?? []), widget.id],
          }));
          delete localDrafts[id];
          setChatDrafts((d) => {
            const next = { ...d };
            delete next[id];
            return next;
          });
          setDrafts((d) => {
            const next = { ...d };
            delete next[id];
            return next;
          });
          setProgress(`${widget.title} 완료`);
        } catch (e) {
          const message = e instanceof Error ? e.message : "위젯 검증 실패";
          setDrafts((d) => ({
            ...d,
            [id]: { ...localDrafts[id], status: "failed", error: message },
          }));
          updateMessage(messageId, (m) => ({
            ...m,
            content: `${m.content}\n${message}`,
            status: "failed",
          }));
        }
      }
      if (frame.type === "command")
        applyOperation(frame.operation as Record<string, unknown>);
      if (frame.type === "failed") {
        setDrafts((d) => ({
          ...d,
          [id]: {
            ...localDrafts[id],
            status: "failed",
            error: String(frame.message),
          },
        }));
        updateMessage(messageId, (m) => ({
          ...m,
          content: `${m.content}\n${String(frame.message)}`,
          status: "failed",
          retryOperations: frame.retryOperation
            ? [
                ...(m.retryOperations ?? []),
                frame.retryOperation as Record<string, unknown>,
              ]
            : m.retryOperations,
        }));
      }
      if (frame.type === "error") throw new Error(String(frame.message));
    };
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          requestId: crypto.randomUUID(),
          history: messages
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content })),
          chatArtifacts: messages
            .flatMap((message) => message.artifacts)
            .slice(-8),
          canvases: captured.canvases,
          widgets: Object.values(captured.widgets),
          activeCanvasId: captured.activeCanvasId,
          selectedWidgetId: captured.selectedWidgetId,
          retryOperations,
        }),
        signal: controller.signal,
      });
      await readFrames(response, controller.signal, receive);
      updateMessage(messageId, (m) => ({
        ...m,
        status:
          m.status === "failed"
            ? "failed"
            : controller.signal.aborted
              ? "cancelled"
              : "complete",
      }));
    } catch (e) {
      const cancelled = controller.signal.aborted;
      updateMessage(messageId, (m) => ({
        ...m,
        status: cancelled ? "cancelled" : "failed",
        content: `${m.content}\n${cancelled ? "생성을 중단했습니다. 완료된 위젯은 유지됩니다." : e instanceof Error ? e.message : "분석 실패"}`,
      }));
      setDrafts((d) =>
        Object.fromEntries(
          Object.entries(d).map(([id, draft]) => [
            id,
            draft.status === "running"
              ? {
                  ...draft,
                  status: cancelled ? "cancelled" : "failed",
                  error: cancelled ? undefined : "연결이 중단됐습니다.",
                }
              : draft,
          ]),
        ),
      );
    } finally {
      setChatDrafts({});
      setRunning(false);
      setProgress("");
      abortRef.current = null;
    }
  };
  const drop = (
    event: DragEvent,
    index?: number,
    canvasId = doc.activeCanvasId,
  ) => {
    event.preventDefault();
    if (!canvasId) return;
    try {
      const payload = JSON.parse(event.dataTransfer.getData(MIME));
      if (payload.source === "chat")
        addPreview(widgetSchema.parse(payload.widget), canvasId);
      else if (payload.source === "canvas" && typeof payload.id === "string")
        dispatch({ type: "move", id: payload.id, canvasId, index });
    } catch {
      useCanvas.getState().setError("지원하는 카드를 놓아 주세요.");
    }
  };
  const resize = (event: PointerEvent<HTMLButtonElement>, widget: Widget) => {
    event.preventDefault();
    event.stopPropagation();
    resizeCleanup.current?.();
    const width = gridRef.current?.clientWidth ?? 900;
    const dx = (width - 16 * 11) / 12 + 16;
    const x = event.clientX,
      y = event.clientY;
    const start = widget.layout;
    const move = (e: globalThis.PointerEvent) => {
      const layout = clampLayout(
        start.w + (e.clientX - x) / dx,
        start.h + (e.clientY - y) / 48,
      );
      dispatch({ type: "layout", id: widget.id, ...layout });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      document.body.style.userSelect = "";
      resizeCleanup.current = null;
    };
    resizeCleanup.current = cleanup;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };
  const newThread = () => {
    const id = crypto.randomUUID();
    setThreads((ts) => [{ id, title: "새 대화", messages: [] }, ...ts]);
    setThreadId(id);
  };
  const selected = doc.selectedWidgetId
    ? doc.widgets[doc.selectedWidgetId]
    : undefined;
  if (!loaded)
    return <div className="workspace-loading">Canvas를 불러오는 중…</div>;
  return (
    <div
      className={`workspace ${dark ? "dark" : ""}`}
      data-theme={dark ? "dark" : "light"}
    >
      <header className="workspace-header">
        <Link className="brand" href="/">
          ◈ <span>Dynamic Canvas</span>
          <small>OpenUI × LangGraph</small>
        </Link>
        <div className="header-actions">
          <span className="local-label">이 브라우저에 저장</span>
          <a href="/chat">전체 OpenUI 채팅 ↗</a>
          <button aria-label="테마 변경" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      {error && (
        <div className="workspace-alert" role="alert">
          {error}
          <button
            aria-label="알림 닫기"
            onClick={() => useCanvas.getState().setError(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {recoveryRaw && (
        <div className="recovery">
          <button onClick={() => download(recoveryRaw, "canvas-original.json")}>
            <Download size={15} />
            원본 내려받기
          </button>
          <button onClick={() => useCanvas.getState().resetRecovery()}>
            원본 백업 후 새로 시작
          </button>
          <RecoveryTable raw={recoveryRaw} />
        </div>
      )}
      <main className="workspace-main">
        <section className="chat-panel" aria-label="분석 채팅">
          <header className="panel-heading">
            <button
              title="대화 목록"
              onClick={() => setShowThreads(!showThreads)}
            >
              {showThreads ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
            <h1>데이터와 대화하기</h1>
            <button title="새 대화" disabled={running} onClick={newThread}>
              <Plus size={18} />
            </button>
          </header>
          {showThreads && (
            <div className="thread-list">
              {threads.map((t) => (
                <div key={t.id}>
                  <button
                    disabled={running}
                    className={threadId === t.id ? "active" : ""}
                    onClick={() => setThreadId(t.id)}
                  >
                    {t.title}
                  </button>
                  <button
                    title="대화 삭제"
                    disabled={running}
                    onClick={() => {
                      const rest = threads.filter((x) => x.id !== t.id);
                      setThreads(rest);
                      if (threadId === t.id) {
                        if (rest.length) setThreadId(rest[0].id);
                        else newThread();
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome">
                <div className="welcome-icon">◈</div>
                <h2>질문에서 대시보드까지</h2>
                <p>
                  매출과 광고 데이터를 살펴보고,
                  <br />
                  필요한 결과를 Canvas에 모아보세요.
                </p>
                {starters.map((s) => (
                  <button key={s} onClick={() => void send(s)}>
                    {s}
                    <span>↗</span>
                  </button>
                ))}
                <small>고정 seed로 생성한 합성 데이터로 분석합니다.</small>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`message ${m.role}`}>
                <div className="message-role">
                  {m.role === "user" ? "나" : "Canvas Assistant"}
                </div>
                {m.content && <p className="message-text">{m.content}</p>}
                {m.sources &&
                  Object.entries(m.sources).some(
                    ([id, version]) =>
                      doc.widgets[id]?.snapshot?.dataVersion !== version,
                  ) && (
                    <small className="stale-explanation">
                      이전 데이터 기준 설명
                    </small>
                  )}
                {m.status === "running" &&
                  Object.values(chatDrafts).map((d) => (
                    <div className="chat-artifact" key={d.id}>
                      <small>OpenUI 응답 생성 중</small>
                      {d.program && (
                        <WidgetRenderer
                          widget={{
                            id: d.id,
                            title: d.title,
                            program: d.program,
                            chartType: "custom",
                            definitionRevision: 0,
                            rendererContractVersion: 1,
                            catalogVersion: 1,
                            refreshPolicy: "snapshot",
                            layout: { w: 6, h: 9 },
                            uiState: {},
                          }}
                          streaming
                        />
                      )}
                    </div>
                  ))}
                {m.artifacts.map((w) => (
                  <div
                    className="chat-artifact"
                    key={w.id}
                    data-testid="chat-artifact"
                  >
                    <div
                      className="preview-drag"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          MIME,
                          JSON.stringify({ source: "chat", widget: w }),
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      title="Canvas로 드래그"
                    >
                      <GripVertical size={14} />
                      {w.title}
                    </div>
                    <WidgetRenderer
                      widget={w}
                      onPrompt={(text) => void send(text)}
                      onState={(state) => {
                        if (JSON.stringify(w.uiState) !== JSON.stringify(state))
                          updateMessage(m.id, (old) => ({
                            ...old,
                            artifacts: old.artifacts.map((a) =>
                              a.id === w.id ? { ...a, uiState: state } : a,
                            ),
                          }));
                      }}
                    />
                    <Freshness widget={w} />
                    <button
                      className="add-button"
                      onClick={() => addPreview(w)}
                    >
                      <Plus size={14} />
                      Canvas에 추가
                    </button>
                  </div>
                ))}
                {m.status === "cancelled" && <small>중단됨</small>}
                {m.status === "failed" &&
                  (!m.completedWidgets?.length ||
                    !!m.retryOperations?.length) && (
                    <button
                      className="text-button"
                      disabled={running}
                      onClick={() =>
                        void send(
                          m.retryOperations?.length
                            ? "실패한 위젯만 다시 시도해줘"
                            : m.retryPrompt ||
                                messages[Math.max(0, messages.indexOf(m) - 1)]
                                  ?.content,
                          m.retryOperations,
                        )
                      }
                    >
                      {m.retryOperations?.length
                        ? "실패한 위젯 다시 시도"
                        : "다시 시도"}
                    </button>
                  )}
              </div>
            ))}
            <div ref={messagesEnd} />
          </div>
          {progress && (
            <div className="progress" role="status">
              <span className="pulse" />
              {progress}
            </div>
          )}
          {selected && (
            <div className="selection-context">
              선택한 위젯: <strong>{selected.title}</strong>
              <button
                aria-label="위젯 선택 해제"
                onClick={() => dispatch({ type: "select", id: null })}
              >
                <X size={13} />
              </button>
            </div>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              aria-label="분석 요청"
              placeholder="질문하거나, Canvas에 만들 차트를 알려주세요"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            {running ? (
              <button
                type="button"
                aria-label="생성 중단"
                onClick={() => abortRef.current?.abort()}
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="요청 보내기"
                disabled={!input.trim()}
              >
                <Send size={18} />
              </button>
            )}
          </form>
        </section>
        <section className="canvas-panel" aria-label="Dynamic Canvas">
          <header className="canvas-heading">
            <div>
              <h2>나의 Canvas</h2>
              <small>필요한 인사이트를 모아 나만의 화면으로</small>
            </div>
            <button
              className="primary"
              onClick={() =>
                dispatch({
                  type: "createCanvas",
                  id: crypto.randomUUID(),
                  title: `Canvas ${doc.canvases.length + 1}`,
                })
              }
            >
              <Plus size={15} />새 Canvas
            </button>
          </header>
          <div className="canvas-tabs" role="tablist">
            {doc.canvases.map((c, i) => (
              <div
                key={c.id}
                className={`canvas-tab ${doc.activeCanvasId === c.id ? "active" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-canvas64-tab", c.id);
                  e.stopPropagation();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const tabId = e.dataTransfer.getData(
                    "application/x-canvas64-tab",
                  );
                  if (tabId) {
                    e.preventDefault();
                    dispatch({ type: "reorderCanvas", id: tabId, index: i });
                  } else drop(e, undefined, c.id);
                }}
              >
                {rename?.id === c.id ? (
                  <>
                    <input
                      aria-label="Canvas 이름"
                      value={rename.title}
                      onChange={(e) =>
                        setRename({ ...rename, title: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          dispatch({
                            type: "renameCanvas",
                            id: c.id,
                            title: rename.title,
                          });
                          setRename(null);
                        }
                      }}
                    />
                    <button
                      title="Canvas 이름 저장"
                      onClick={() => {
                        dispatch({
                          type: "renameCanvas",
                          id: c.id,
                          title: rename.title,
                        });
                        setRename(null);
                      }}
                    >
                      <Check size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      role="tab"
                      aria-selected={doc.activeCanvasId === c.id}
                      onClick={() =>
                        dispatch({ type: "selectCanvas", id: c.id })
                      }
                    >
                      {c.title}
                      <span>{c.widgetIds.length}</span>
                    </button>
                    <button
                      title="Canvas 이름 변경"
                      onClick={() => setRename({ id: c.id, title: c.title })}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      title="Canvas 삭제"
                      onClick={() =>
                        setConfirmation({
                          label: `‘${c.title}’ Canvas와 위젯을 삭제할까요?`,
                          command: { type: "removeCanvas", id: c.id },
                        })
                      }
                    >
                      <X size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {selected && (
            <div className="canvas-selection-toolbar">
              <span>{selected.title}</span>
              <button
                title="앞으로 이동"
                onClick={() =>
                  dispatch({
                    type: "move",
                    id: selected.id,
                    canvasId: selected.canvasId!,
                    index: Math.max(
                      0,
                      (activeCanvas?.widgetIds.indexOf(selected.id) ?? 0) - 1,
                    ),
                  })
                }
              >
                <ArrowLeft size={14} />
              </button>
              <button
                title="뒤로 이동"
                onClick={() =>
                  dispatch({
                    type: "move",
                    id: selected.id,
                    canvasId: selected.canvasId!,
                    index:
                      (activeCanvas?.widgetIds.indexOf(selected.id) ?? 0) + 1,
                  })
                }
              >
                <ArrowRight size={14} />
              </button>
              <select
                aria-label="선택 위젯 이동할 Canvas"
                value={selected.canvasId}
                onChange={(e) =>
                  dispatch({
                    type: "move",
                    id: selected.id,
                    canvasId: e.target.value,
                  })
                }
              >
                {doc.canvases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div
            className="canvas-drop-zone"
            data-testid="canvas-drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e)}
          >
            {!activeCanvas?.widgetIds.length &&
              !Object.values(drafts).some(
                (d) => d.canvasId === doc.activeCanvasId,
              ) && (
                <div className="canvas-empty">
                  <div>▦</div>
                  <h3>첫 인사이트를 놓아보세요</h3>
                  <p>
                    채팅의 카드를 드래그하거나
                    <br />
                    “Canvas에 매출 차트를 만들어줘”라고 요청하세요.
                  </p>
                  <small>이동 · 정렬 · 크기 조절 · 자동 저장</small>
                </div>
              )}
            <div className="canvas-grid" ref={gridRef}>
              {activeCanvas?.widgetIds.map((id) => (
                <CanvasCard
                  key={id}
                  widget={doc.widgets[id]}
                  draft={drafts[id]}
                  onPrompt={(text) => void send(text)}
                  onRemove={() => dispatch({ type: "remove", id })}
                  onDrop={drop}
                  onResize={resize}
                />
              ))}
              {Object.values(drafts)
                .filter(
                  (d) =>
                    d.canvasId === doc.activeCanvasId && !doc.widgets[d.id],
                )
                .map((d) => (
                  <div className="draft-card" key={d.id}>
                    <strong>{d.title}</strong>
                    <p>
                      {d.status === "running"
                        ? "차트를 구성하고 있습니다…"
                        : d.error || "생성이 중단되었습니다."}
                    </p>
                    {d.program && d.status === "running" && (
                      <WidgetRenderer
                        widget={{
                          id: d.id,
                          title: d.title,
                          program: d.program,
                          chartType: "custom",
                          definitionRevision: 0,
                          rendererContractVersion: 1,
                          catalogVersion: 1,
                          refreshPolicy: "snapshot",
                          layout: { w: 6, h: 9 },
                          uiState: {},
                        }}
                        streaming
                      />
                    )}
                    {d.status !== "running" && (
                      <button
                        onClick={() =>
                          setDrafts((ds) => {
                            const next = { ...ds };
                            delete next[d.id];
                            return next;
                          })
                        }
                      >
                        닫기
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
          <footer className="canvas-footer">
            <span>
              {activeCanvas?.widgetIds.length ?? 0}개 위젯 · 12열 그리드
            </span>
            <button
              disabled={!activeCanvas?.widgetIds.length}
              onClick={() =>
                activeCanvas &&
                setConfirmation({
                  label: "이 Canvas의 위젯을 모두 지울까요?",
                  command: { type: "clearCanvas", id: activeCanvas.id },
                })
              }
            >
              <Trash2 size={13} />
              Canvas 비우기
            </button>
          </footer>
        </section>
      </main>
      {confirmation && (
        <div className="dialog-backdrop">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="삭제 확인"
          >
            <p>{confirmation.label}</p>
            <div>
              <button onClick={() => setConfirmation(null)}>취소</button>
              <button
                className="danger"
                onClick={() => {
                  dispatch(confirmation.command);
                  setConfirmation(null);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecoveryTable({ raw }: { raw: string }) {
  let widgets: Widget[];
  try {
    const value = JSON.parse(raw);
    widgets = Object.values(value.widgets ?? {}) as Widget[];
  } catch {
    return null;
  }
  return (
    <div>
      {widgets
        .filter((w) => snapshotSchema.safeParse(w?.snapshot).success)
        .map((w) => (
          <div key={w.id}>
            <p>{w.title} · 읽기 전용 마지막 결과</p>
            <DataTable snapshot={w.snapshot!} />
          </div>
        ))}
    </div>
  );
}
