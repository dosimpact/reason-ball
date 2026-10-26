"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  ChatProvider,
  useThread,
  useThreadList,
} from "@openuidev/react-headless";
import { ThemeProvider } from "@openuidev/react-ui";
import {
  ArtifactContext,
  ArtifactView,
  renderedArtifactIds,
  EMPTY,
  type Panel,
} from "@/entities/dashboard";
import {
  Canvas,
  useDashboard,
  loadDashboard,
  command,
  addArtifact,
  dashboardLLM,
  dashboardStorage,
} from "@/features/dashboard";
import { ChatMessage } from "./chat-message";
import { Welcome } from "./welcome";
import { WorkspaceSplitter } from "./workspace-splitter";
import "./workspace.css";

export default function Workspace() {
  const [dark, setDark] = useState(true);
  return (
    <ThemeProvider mode={dark ? "dark" : "light"}>
      <ChatProvider llm={dashboardLLM} storage={dashboardStorage}>
        <WorkspaceBody dark={dark} toggleTheme={() => setDark((v) => !v)} />
      </ChatProvider>
    </ThemeProvider>
  );
}
function WorkspaceBody({
  dark,
  toggleTheme,
}: {
  dark: boolean;
  toggleTheme: () => void;
}) {
  const thread = useThread();
  const { isRunning, setMessages } = thread;
  const list = useThreadList();
  const id = list.selectedThreadId;
  const state = useDashboard((s) => (id ? (s.documents[id] ?? EMPTY) : EMPTY));
  const [input, setInput] = useState("");
  const [view, setView] = useState<"split" | "chat" | "canvas">("split");
  const [sidebar, setSidebar] = useState(true);
  const [notice, setNotice] = useState("");
  const [chatWidth, setChatWidth] = useState(48);
  useEffect(() => {
    const query = window.matchMedia("(max-width:800px)");
    const update = () => setSidebar(!query.matches);
    const frame = requestAnimationFrame(update);
    query.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      query.removeEventListener("change", update);
    };
  }, []);
  const completedThread = useRef<string | null>(null);
  useEffect(() => {
    if (isRunning) {
      completedThread.current = id;
      return;
    }
    const finished = completedThread.current;
    completedThread.current = null;
    if (!finished || finished !== id) return;
    let obsolete = false;
    // Server history excludes rejected drafts; reconcile after streaming finishes.
    void dashboardStorage.thread
      .getMessages(finished)
      .then((messages) => {
        if (!obsolete) setMessages(messages);
      })
      .catch((error) => {
        if (!obsolete) setNotice(error.message);
      });
    return () => {
      obsolete = true;
    };
  }, [id, isRunning, setMessages]);
  const bottom = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  useEffect(() => {
    list.loadThreads();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (restored.current || list.isLoadingThreads || !list.threads.length)
      return;
    restored.current = true;
    const previous = localStorage.getItem("sec-dashboard:thread");
    if (previous && list.threads.some((t) => t.id === previous))
      list.selectThread(previous);
  }, [list]);
  useEffect(() => {
    if (id) {
      localStorage.setItem("sec-dashboard:thread", id);
      void loadDashboard(id).catch((e) => setNotice(e.message));
    }
  }, [id]);
  useEffect(() => {
    document.documentElement.dataset.openuiTheme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.messages, thread.isRunning]);
  useEffect(() => {
    if (state.selected_panel_id)
      document
        .getElementById(`panel-${state.selected_panel_id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.selected_panel_id, state.active_tab_id]);
  const inlineArtifacts = useMemo(
    () =>
      new Set(
        thread.messages.flatMap((message) =>
          message.role === "assistant" &&
          "content" in message &&
          typeof message.content === "string"
            ? renderedArtifactIds(message.content)
            : [],
        ),
      ),
    [thread.messages],
  );
  const send = (text: string) => {
    if (!text.trim() || thread.isRunning) return;
    setInput("");
    setNotice("");
    void thread
      .processMessage({ role: "user", content: text })
      .catch((e) => setNotice(e.message));
  };
  const add = (panel: Panel) => {
    if (id)
      void addArtifact(id, panel)
        .then(() => setView("split"))
        .catch((e) => setNotice(e.message));
  };
  const focus = (panelId: string) => {
    if (id)
      void command(id, "select", panelId)
        .then(() => setView("split"))
        .catch((e) => setNotice(e.message));
  };
  return (
    <div className={`research-app ${dark ? "dark" : "light"}`}>
      <header className="app-header">
        <button
          aria-label="대화 목록 토글"
          onClick={() => setSidebar((v) => !v)}
        >
          ☰
        </button>
        <div className="brand-mark">◈</div>
        <strong>Filing Studio</strong>
        <span className="app-subtitle">SEC research, in conversation</span>
        <div className="header-spacer" />
        <a href="/onboarding" target="_blank">
          사용 안내 ↗
        </a>
        <a href="/gallery" target="_blank">
          UI 갤러리
        </a>
        <button aria-label="테마 전환" onClick={toggleTheme}>
          {dark ? "☀" : "☾"}
        </button>
      </header>
      <div className="app-body">
        {sidebar && (
          <aside className="thread-sidebar">
            <button
              className="new-thread"
              onClick={() => {
                list.switchToNewThread();
                setView("split");
                localStorage.removeItem("sec-dashboard:thread");
                setNotice("");
              }}
            >
              ＋ 새 분석
            </button>
            <span className="eyebrow">RESEARCH HISTORY</span>
            <nav aria-label="대화 목록">
              {list.threads.map((t) => (
                <div
                  className={`thread-row ${id === t.id ? "active" : ""}`}
                  key={t.id}
                >
                  <button onClick={() => list.selectThread(t.id)}>
                    {t.title}
                  </button>
                  <button
                    aria-label={`${t.title} 이름 변경`}
                    onClick={() => {
                      const title = prompt("대화 이름", t.title);
                      if (title) list.updateThread({ ...t, title });
                    }}
                  >
                    ⋯
                  </button>
                  <button
                    aria-label={`${t.title} 대화 삭제`}
                    disabled={thread.isRunning && id === t.id}
                    onClick={() => {
                      if (confirm("이 대화를 삭제할까요?"))
                        list.deleteThread(t.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </nav>
            <div className="sidebar-foot">
              <a href="/documents">보고서 라이브러리 ↗</a>
              <span>
                Source-grounded analysis
                <br />
                Your own research workspace
              </span>
            </div>
          </aside>
        )}
        <main className="workspace-main">
          <div className="workspace-toolbar">
            <div>
              <span className="eyebrow">WORKSPACE</span>
              <h1>
                {list.threads.find((t) => t.id === id)?.title ??
                  "새로운 관점으로 기업을 읽다"}
              </h1>
            </div>
            <div className="view-switch">
              {(["chat", "split", "canvas"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === "chat"
                    ? "대화"
                    : v === "split"
                      ? "대화 + Canvas"
                      : "Canvas"}
                </button>
              ))}
            </div>
          </div>
          {notice && (
            <div role="alert" className="notice">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>닫기</button>
            </div>
          )}
          <ArtifactContext.Provider
            value={{ threadId: id, artifacts: state.artifacts, add, focus }}
          >
            <div
              className={`workspace-content view-${view}`}
              style={{ "--chat-width": `${chatWidth}%` } as React.CSSProperties}
            >
              {view !== "canvas" && (
                <section className="chat-pane" aria-label="Research chat">
                  <div className="chat-scroll">
                    {!thread.messages.length && <Welcome send={send} />}
                    {thread.messages
                      .filter(
                        (m) => m.role === "user" || m.role === "assistant",
                      )
                      .map((message, index) => (
                        <ChatMessage
                          key={message.id ?? index}
                          message={message}
                          messages={thread.messages}
                          streaming={thread.isRunning}
                          send={send}
                        />
                      ))}
                    {state.artifacts.length > 0 && (
                      <section
                        className="artifact-shelf"
                        aria-label="저장 가능한 분석 결과"
                      >
                        <span className="eyebrow">CANVAS에 담을 결과</span>
                        {state.artifacts
                          .filter((panel) => !inlineArtifacts.has(panel.id))
                          .map((panel) => (
                            <ArtifactView key={panel.id} id={panel.id} />
                          ))}
                      </section>
                    )}
                    {thread.isRunning && (
                      <div className="run-progress" role="status">
                        <span />
                        보고서와 분석 결과를 확인하고 있습니다…{" "}
                        <button
                          onClick={() => {
                            thread.cancelMessage();
                            setNotice(
                              "분석을 중단했습니다. 생성 중이던 답변은 완성되지 않았을 수 있습니다. 저장된 결과는 유지됩니다.",
                            );
                          }}
                        >
                          중지
                        </button>
                      </div>
                    )}
                    {thread.threadError && (
                      <p className="notice" role="alert">
                        {thread.threadError.message}
                      </p>
                    )}
                    <div ref={bottom} />
                  </div>
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send(input);
                    }}
                  >
                    <label className="sr-only" htmlFor="research-question">
                      기업이나 보고서에 대해 질문하세요
                    </label>
                    <textarea
                      id="research-question"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="기업을 찾거나, 보고서를 비교하거나, Canvas를 수정해 보세요…"
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          send(input);
                        }
                      }}
                    />
                    <div>
                      <span>
                        {state.selected_panel_id
                          ? `선택한 패널: ${state.panels.find((p) => p.id === state.selected_panel_id)?.title}`
                          : "Enter 전송 · Shift + Enter 줄바꿈"}
                      </span>
                      <button
                        type="submit"
                        disabled={thread.isRunning || !input.trim()}
                      >
                        전송 ↑
                      </button>
                    </div>
                  </form>
                </section>
              )}
              {view === "split" && (
                <WorkspaceSplitter
                  chatWidth={chatWidth}
                  setChatWidth={setChatWidth}
                />
              )}
              {view !== "chat" &&
                (id ? (
                  <Canvas threadId={id} state={state} />
                ) : (
                  <section className="canvas-pane">
                    <div className="canvas-empty">
                      <span className="grid-symbol">▦</span>
                      <h3>당신의 분석 대시보드</h3>
                      <p>대화를 시작하고 원하는 결과를 Canvas에 담으세요.</p>
                    </div>
                  </section>
                ))}
            </div>
          </ArtifactContext.Provider>
        </main>
      </div>
    </div>
  );
}
