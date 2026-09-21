"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  PlannerDocument,
  Project,
} from "@/entities/document/model/schema";
import { ContentView } from "@/entities/document/ui/content-view";
import { FlowSpecViewer, FlowSpecEditor } from "@/features/flow-spec-syntax";
import {
  reconcileCollapsed,
  type FlowTree,
} from "@/features/flow-spec-syntax/parser";
import type { Relations } from "@/entities/document/lib/references";
import { DocumentRelations } from "./document-relations";
import { CollaborationHub } from "./collaboration-hub";
import type { CollaborationProject } from "@/entities/document/model/collaboration";
import { plannerMutation, plannerRequest } from "@/shared/api/client";
import { createRequestId } from "@/shared/lib/request-id";

type Index = {
  documents: Pick<
    PlannerDocument,
    "id" | "title" | "scope" | "type" | "status" | "revision" | "updatedAt"
  >[];
  problems: { projectId: string; documentId?: string; message: string }[];
};
type CatalogEntry = {
  type: string;
  name: string;
  purpose: string;
  contentSchema: unknown;
  example: unknown;
};
const statusLabel = {
  draft: "초안",
  reviewed: "검토 완료",
  approved: "승인됨",
};
export function Workspace({ catalog }: { catalog: CatalogEntry[] }) {
  const [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project | null>(null);
  const [projectId, setProjectId] = useState(""),
    [documentId, setDocumentId] = useState("");
  const [index, setIndex] = useState<Index>({ documents: [], problems: [] }),
    [doc, setDoc] = useState<PlannerDocument | null>(null);
  const [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [collaboration, setCollaboration] = useState<CollaborationProject[]>(
    [],
  );
  const [tab, setTab] = useState("documents"),
    [scope, setScope] = useState(""),
    [selected, setSelected] = useState<
      { documentId: string; revision: number; title: string }[]
    >([]),
    [handoff, setHandoff] = useState("");
  const generation = useRef(0);
  const mutationRunning = useRef(false);
  const [retry, setRetry] = useState<{
    requestId: string;
    resume: () => void;
  } | null>(null);
  const [viewRevision, setViewRevision] = useState<number | undefined>();
  const [relations, setRelations] = useState<Relations>({
    outgoing: [],
    incoming: [],
  });
  const [flowStates, setFlowStates] = useState<Record<string, Set<string>>>({});
  const figmaRequest = useRef<{ payload: string; id: string } | null>(null);
  const flowKey = doc
    ? `${doc.projectId}/${doc.id}/${viewRevision ?? "current"}`
    : "";
  const navigate = (id: string, revision?: number) => {
    if (mutationRunning.current) {
      setError("저장 결과를 확인한 뒤 문서를 전환하세요.");
      return;
    }
    if (id === documentId && revision === viewRevision) {
      setTab("documents");
      return;
    }
    generation.current++;
    setDocumentId(id);
    setViewRevision(revision);
    setDoc(null);
    setRelations({ outgoing: [], incoming: [] });
    setTab("documents");
  };
  const typeName = (type: string) =>
    catalog.find((c) => c.type === type)?.name ?? type;
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    void plannerRequest<CollaborationProject[]>({
      action: "collaboration",
    }).then(
      (overview) => {
        if (token !== generation.current) return;
        setCollaboration(overview);
        setSummaryError("");
      },
      () => {
        if (token !== generation.current) return;
        setCollaboration([]);
        setSummaryError(
          "협업 요약을 불러오지 못했습니다. 프로젝트와 문서는 계속 조회할 수 있습니다.",
        );
      },
    );
    try {
      const [all, p, idx, current, links] = await Promise.all([
        plannerRequest<Project[]>({ action: "projects" }),
        projectId
          ? plannerRequest<Project>({ action: "project", projectId })
          : null,
        projectId
          ? plannerRequest<Index>({ action: "index", projectId })
          : null,
        projectId && documentId
          ? plannerRequest<PlannerDocument>({
              action: "document",
              projectId,
              documentId,
              ...(viewRevision ? { revision: viewRevision } : {}),
            }).catch(() => null)
          : null,
        projectId && documentId
          ? plannerRequest<Relations>({
              action: "relations",
              projectId,
              documentId,
              ...(viewRevision ? { revision: viewRevision } : {}),
            }).catch(() => null)
          : null,
      ]);
      if (token !== generation.current) return;
      setLoadError("");
      setProjects(all);
      setProjectsLoaded(true);
      setProject(p);
      if (idx) setIndex(idx);
      setDoc(current);
      setRelations(links ?? { outgoing: [], incoming: [] });
      if (current?.type.startsWith("flow-spec")) {
        const key = `${current.projectId}/${current.id}/${viewRevision ?? "current"}`;
        setFlowStates((states) => ({
          ...states,
          [key]: reconcileCollapsed(
            current.content as FlowTree,
            states[key] ?? new Set(),
          ),
        }));
      }
      if (viewRevision && !current)
        setLoadError(
          "해당 역사 버전을 읽을 수 없습니다. 문서 목록에서 현재 버전을 선택하세요.",
        );
    } catch (e) {
      if (token === generation.current) setLoadError(String(e));
    }
  }, [projectId, documentId, viewRevision]);
  useEffect(() => {
    // Schedule the initial read independently of the SSE connection lifecycle.
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const events = new EventSource("/api/events");
    const ready = () => {
      setConnected(true);
      void refresh();
    };
    events.addEventListener("ready", ready);
    events.addEventListener("change", () => {
      void refresh();
    });
    events.onerror = () => setConnected(false);
    const online = () => {
      void refresh();
    };
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", online);
      events.close();
    };
  }, [refresh]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function mutate(input: Record<string, unknown>) {
    if (mutationRunning.current) {
      setError("진행 중인 저장 결과를 먼저 확인하세요.");
      return null;
    }
    mutationRunning.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await plannerMutation(
        input,
        () =>
          new Promise<void>((resume) => {
            setRetry({ requestId: String(input.requestId), resume });
          }),
      );
      await refresh();
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      mutationRunning.current = false;
      setRetry(null);
      setBusy(false);
    }
  }
  function chooseProject(next: string) {
    if (mutationRunning.current) {
      setError("저장 결과를 확인한 뒤 프로젝트를 전환하세요.");
      return;
    }
    generation.current++;
    setProjectId(next);
    setProject(null);
    setDocumentId("");
    setViewRevision(undefined);
    setDoc(null);
    setIndex({ documents: [], problems: [] });
    setSelected([]);
    setScope("");
    setHandoff("");
    setTab("home");
  }
  const shown = index.documents.filter((d) => !scope || d.scope === scope);
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/">
          P<span>Planner MCP</span>
        </Link>
        <Link className="template-entry" href="/templates">
          문서 템플릿 관리 →
        </Link>
        <div className="eyebrow">DESIGN WORKSPACE</div>
        <h2>프로젝트</h2>
        <button type="button" onClick={() => chooseProject("")}>
          전체 프로젝트
        </button>
        <nav>
          {projects.map((p) => (
            <button
              className={projectId === p.id ? "project active" : "project"}
              key={p.id}
              onClick={() => chooseProject(p.id)}
            >
              <span>▧</span>
              {p.name}
            </button>
          ))}
        </nav>
        <details className="new-project">
          <summary>＋ 프로젝트 만들기</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const p = (await mutate({
                action: "createProject",
                requestId: createRequestId(),
                name: data.get("name"),
                description: data.get("description"),
              })) as Project | null;
              if (p) chooseProject(p.id);
            }}
          >
            <label>
              프로젝트 이름
              <input name="name" required placeholder="예: Google Ads" />
            </label>
            <label>
              설명
              <textarea name="description" />
            </label>
            <button disabled={busy} className="primary">
              생성
            </button>
          </form>
        </details>
        <footer>
          <span className={`connection ${connected ? "online" : ""}`} />
          {connected ? "실시간 연결됨" : "연결 복구 중"}
          <small>로컬 워크스페이스 · MCP /mcp</small>
          <button onClick={() => void refresh()}>목록 새로고침</button>
        </footer>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <div className="eyebrow">PROJECT SPECIFICATIONS</div>
            <h1>{project?.name ?? "프로젝트 목록"}</h1>
            <p>
              {project?.description ||
                "요구사항에서 설계로, 승인된 설계에서 구현으로."}
            </p>
          </div>
          <span className="count">
            {project
              ? `${index.documents.length} documents`
              : `${projects.length} projects`}
          </span>
        </header>
        {retry && (
          <section role="alert" className="alert" aria-label="저장 결과 미확인">
            <p>저장 응답을 확인하지 못했습니다. 이미 저장되었을 수 있습니다.</p>
            <p>
              추가 저장을 멈췄습니다. 새로고침하지 말고 같은 요청으로 결과를
              확인하세요.
            </p>
            <small>요청 ID: {retry.requestId}</small>
            <button
              onClick={() => {
                const resume = retry.resume;
                setRetry(null);
                resume();
              }}
            >
              같은 요청으로 재시도
            </button>
          </section>
        )}
        {(error || loadError) && (
          <div role="alert" className="alert">
            {error || loadError}
            <button
              onClick={() => {
                setError("");
                setLoadError("");
              }}
            >
              닫기
            </button>
          </div>
        )}
        {!!index.problems.length && (
          <div role="alert" className="alert">
            데이터 파일 오류 · 표시된 문서는 마지막 정상 상태일 수 있습니다.
            {index.problems.map((p, i) => (
              <p key={i}>
                {p.documentId}: {p.message}
              </p>
            ))}
          </div>
        )}
        {summaryError && (
          <div role="alert" className="alert">
            {summaryError}
            <button onClick={() => void refresh()}>협업 요약 재시도</button>
          </div>
        )}
        {!project && (projectId || !projectsLoaded) ? (
          <section aria-label="프로젝트 로딩" className="welcome">
            <p role="status">
              {loadError
                ? "프로젝트를 불러오지 못했습니다."
                : "프로젝트를 불러오는 중…"}
            </p>
            <button onClick={() => void refresh()}>다시 불러오기</button>
          </section>
        ) : !project && projects.length > 0 ? (
          <section aria-label="전체 프로젝트 목록">
            <p className="muted">
              프로젝트를 선택해 설계 문서와 입력 자료를 확인하세요.
            </p>
            <ul className="project-grid">
              {projects.map((item) => (
                <li key={item.id} className="project-card">
                  <h2>{item.name}</h2>
                  <p>{item.description || "설명이 없습니다."}</p>
                  {collaboration
                    .filter((c) => c.id === item.id)
                    .map((c) => (
                      <p key={c.id}>
                        미해결 질문{" "}
                        {c.documents.reduce(
                          (n, d) =>
                            n +
                            d.openQuestions.filter((q) => !q.resolved).length,
                          0,
                        )}
                        개 · 검토 대기{" "}
                        {
                          c.documents.filter((d) => d.status !== "approved")
                            .length
                        }
                        개{c.problems.length > 0 && " · 일부 요약 확인 불가"}
                      </p>
                    ))}
                  <button
                    type="button"
                    aria-label={`${item.name} 프로젝트 열기`}
                    onClick={() => chooseProject(item.id)}
                  >
                    프로젝트 열기 →
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : !project ? (
          <section className="welcome">
            <div className="welcome-symbol">▧</div>
            <h2>첫 프로젝트를 시작하세요</h2>
            <p>
              원본 요구사항을 보존하고, AI가 작성한 문서를 검토하세요.
              <br />
              구현 에이전트는 승인된 문서 버전을 가져갑니다.
            </p>
            <p className="muted">
              왼쪽의 ‘프로젝트 만들기’로 시작할 수 있습니다.
            </p>
          </section>
        ) : (
          <>
            <div className="tabs">
              {[
                ["home", "프로젝트 홈"],
                ["inbox", "검토함"],
                ["documents", "설계 문서"],
                ["sources", "입력 자료"],
                ["catalog", "문서 카탈로그"],
                ["handoff", "개발 인계"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {(tab === "home" || tab === "inbox") && summaryError ? (
              <section className="panel">
                <h2>협업 요약 확인 필요</h2>
                <p>
                  위 재시도 버튼을 이용하거나 설계 문서 탭에서 문서를
                  확인하세요.
                </p>
              </section>
            ) : (
              (tab === "home" || tab === "inbox") && (
                <CollaborationHub
                  key={project.id}
                  project={project}
                  data={collaboration.find((c) => c.id === project.id)}
                  inbox={tab === "inbox"}
                  navigate={navigate}
                  changeTab={setTab}
                  mutate={mutate}
                />
              )
            )}
            {tab === "documents" && (
              <div className="document-layout">
                <section className="document-list">
                  <label className="filter-label">
                    Scope
                    <select
                      aria-label="scope 필터"
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      <option value="">전체 범위</option>
                      {[...new Set(index.documents.map((d) => d.scope))].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {!shown.length && (
                    <div className="empty">
                      <h3>아직 문서가 없습니다</h3>
                      <p>
                        카탈로그에서 타입을 확인한 뒤 설계 AI에게 MCP로 작성을
                        요청하세요.
                      </p>
                      <button onClick={() => setTab("catalog")}>
                        카탈로그 보기 →
                      </button>
                    </div>
                  )}
                  {shown.map((d) => (
                    <button
                      className={`document-item ${documentId === d.id ? "active" : ""}`}
                      key={d.id}
                      onClick={() => navigate(d.id)}
                    >
                      <small>{typeName(d.type)}</small>
                      <strong>{d.title}</strong>
                      <div>
                        <span className="badge scope">{d.scope}</span>
                        <span className={`status ${d.status}`}>
                          {statusLabel[d.status]}
                        </span>
                        <small>r{d.revision}</small>
                      </div>
                    </button>
                  ))}
                </section>
                <section className="document-detail">
                  {!doc ? (
                    <div className="empty">
                      <h2>문서를 선택하세요</h2>
                      <p>
                        타입에 맞는 시각화와 검토 내용을 확인할 수 있습니다.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="detail-heading">
                        <div className="eyebrow">{typeName(doc.type)}</div>
                        <h2>{doc.title}</h2>
                        <div className="toolbar">
                          <span className="badge scope">{doc.scope}</span>
                          <span className={`status ${doc.status}`}>
                            {statusLabel[doc.status]}
                          </span>
                          <small>revision {doc.revision}</small>
                        </div>
                      </div>
                      {doc.type.startsWith("flow-spec") ? (
                        <FlowSpecViewer
                          key={doc.id}
                          tree={doc.content as FlowTree}
                          collapsed={flowStates[flowKey] ?? new Set()}
                          setCollapsed={(update) =>
                            setFlowStates((states) => ({
                              ...states,
                              [flowKey]:
                                typeof update === "function"
                                  ? update(states[flowKey] ?? new Set())
                                  : update,
                            }))
                          }
                        />
                      ) : (
                        <ContentView document={doc} />
                      )}
                      {doc.type.startsWith("flow-spec") && !viewRevision && (
                        <FlowSpecEditor
                          key={doc.id}
                          tree={doc.content as FlowTree}
                          revision={doc.revision}
                          save={async (edit, expectedRevision, requestId) =>
                            !!(await mutate({
                              action: "editFlow",
                              projectId,
                              documentId: doc.id,
                              requestId,
                              expectedRevision,
                              edit,
                            }))
                          }
                        />
                      )}
                      <DocumentRelations
                        key={`${doc.id}/${doc.revision}/${viewRevision ?? "current"}`}
                        document={doc}
                        relations={relations}
                        navigate={navigate}
                        historical={!!viewRevision}
                      />
                      <section className="context">
                        <h3>설계 맥락</h3>
                        {[
                          ["확정 사실", doc.facts],
                          ["가정", doc.assumptions],
                          ["미결정 질문", doc.openQuestions],
                        ].map(([label, items]) => (
                          <div key={label as string}>
                            <h4>{label as string}</h4>
                            {(items as typeof doc.facts).length ? (
                              <ul>
                                {(items as typeof doc.facts).map((s) => (
                                  <li key={s.id}>
                                    {s.text}
                                    {"resolved" in s && (
                                      <span className="badge">
                                        {s.resolved ? "해결됨" : "미해결"}
                                        {"blocking" in s &&
                                        s.blocking &&
                                        !s.resolved
                                          ? " · 승인 차단"
                                          : ""}
                                      </span>
                                    )}
                                    {"answer" in s &&
                                      typeof s.answer === "string" && (
                                        <p>답변: {s.answer}</p>
                                      )}
                                    {s.sourceIds.map((id) => {
                                      const source = project.sources.find(
                                        (candidate) => candidate.id === id,
                                      );
                                      return source ? (
                                        <details key={id}>
                                          <summary>
                                            근거 원문: {source.title}
                                          </summary>
                                          <p>
                                            수집 시각:{" "}
                                            <time dateTime={source.capturedAt}>
                                              {source.capturedAt}
                                            </time>
                                          </p>
                                          <pre>{source.originalText}</pre>
                                          {source.url && (
                                            <a
                                              href={source.url}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              원본 링크 열기
                                            </a>
                                          )}
                                        </details>
                                      ) : (
                                        <p key={id} role="status">
                                          근거 입력을 찾을 수 없습니다: {id}
                                        </p>
                                      );
                                    })}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="muted">기록된 항목 없음</p>
                            )}
                          </div>
                        ))}
                      </section>
                      {!viewRevision && (
                        <section className="review">
                          <h3>검토와 승인</h3>
                          <div className="toolbar">
                            <button
                              disabled={busy || doc.status !== "draft"}
                              onClick={() =>
                                void mutate({
                                  action: "review",
                                  requestId: createRequestId(),
                                  projectId,
                                  documentId: doc.id,
                                  expectedRevision: doc.revision,
                                  transition: "review",
                                  actor: "로컬 사용자",
                                })
                              }
                            >
                              검토 완료
                            </button>
                            <button
                              className="primary"
                              disabled={busy || doc.status !== "reviewed"}
                              onClick={() =>
                                void mutate({
                                  action: "review",
                                  requestId: createRequestId(),
                                  projectId,
                                  documentId: doc.id,
                                  expectedRevision: doc.revision,
                                  transition: "approve",
                                  actor: "로컬 사용자",
                                })
                              }
                            >
                              개발용 승인
                            </button>
                          </div>
                          {doc.approval && (
                            <p className="muted">
                              {doc.approval.by} · 승인 버전 r
                              {doc.approval.revision}
                            </p>
                          )}
                          {doc.comments.map((c) => (
                            <blockquote key={c.id}>
                              <p>{c.text}</p>
                              <small>
                                {c.author} · r{c.revision}
                              </small>
                            </blockquote>
                          ))}
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.currentTarget,
                                data = new FormData(form);
                              const result = await mutate({
                                action: "comment",
                                requestId: createRequestId(),
                                projectId,
                                documentId: doc.id,
                                expectedRevision: doc.revision,
                                text: data.get("comment"),
                                author: "로컬 사용자",
                              });
                              if (result) form.reset();
                            }}
                          >
                            <label>
                              질문 또는 검토 의견
                              <textarea
                                name="comment"
                                required
                                placeholder="AI가 보완해야 할 내용을 남기세요."
                              />
                            </label>
                            <button disabled={busy}>의견 남기기</button>
                          </form>
                        </section>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}
            {tab === "sources" && (
              <section className="panel">
                <h2>원본 요구사항과 참고 자료</h2>
                <p className="muted">
                  원문은 보존되며 새로운 입력은 추가로 기록됩니다.
                </p>
                <form
                  aria-label="Figma 가져오기"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    const url = String(data.get("figmaUrl")),
                      depth = Number(data.get("depth"));
                    const payload = JSON.stringify({ projectId, url, depth });
                    if (figmaRequest.current?.payload !== payload)
                      figmaRequest.current = { payload, id: createRequestId() };
                    const imported = await mutate({
                      action: "importFigma",
                      projectId,
                      requestId: figmaRequest.current.id,
                      url,
                      depth,
                    });
                    if (imported) figmaRequest.current = null;
                  }}
                >
                  <h3>Figma에서 가져오기</h3>
                  <p>파일·노드 내용과 Figma 버전을 원본 자료로 보존합니다.</p>
                  <label>
                    Figma 파일 또는 노드 URL
                    <input
                      name="figmaUrl"
                      type="url"
                      required
                      placeholder="https://www.figma.com/design/…"
                    />
                  </label>
                  <label>
                    Figma 조회 깊이
                    <input
                      name="depth"
                      type="number"
                      min="1"
                      max="10"
                      defaultValue="2"
                      required
                    />
                  </label>
                  <button disabled={busy}>Figma 원본 가져오기</button>
                </form>
                {project.sources.map((s) => (
                  <article className="spec-card" key={s.id}>
                    <h3>
                      {s.title} <span className="badge">{s.kind}</span>
                    </h3>
                    <pre>{s.originalText}</pre>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        참고 자료 열기 ↗
                      </a>
                    )}
                    <small>
                      {s.id} · 수집 {s.capturedAt}
                    </small>
                  </article>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      data = new FormData(form);
                    const url = data.get("url");
                    const result = await mutate({
                      action: "addSource",
                      requestId: createRequestId(),
                      projectId,
                      source: {
                        kind: data.get("kind"),
                        title: data.get("title"),
                        originalText: data.get("originalText"),
                        ...(url ? { url } : {}),
                      },
                    });
                    if (result) form.reset();
                  }}
                >
                  <div className="form-row">
                    <label>
                      종류
                      <select name="kind">
                        <option value="requirement">요구사항</option>
                        <option value="figma">Figma</option>
                        <option value="reference">참고 자료</option>
                      </select>
                    </label>
                    <label>
                      제목
                      <input name="title" required />
                    </label>
                  </div>
                  <label>
                    원본 내용
                    <textarea name="originalText" required />
                  </label>
                  <label>
                    참고 URL
                    <input name="url" type="url" />
                  </label>
                  <button className="primary" disabled={busy}>
                    입력 보존
                  </button>
                </form>
              </section>
            )}
            {tab === "catalog" && (
              <section className="catalog-grid">
                {catalog.map((c) => (
                  <article className="spec-card" key={c.type}>
                    <div className="eyebrow">SCHEMA V1</div>
                    <h3>{c.name}</h3>
                    <p>{c.purpose}</p>
                    <code>{c.type}</code>
                    <details>
                      <summary>작성 예시</summary>
                      <pre>{JSON.stringify(c.example, null, 2)}</pre>
                    </details>
                    <details>
                      <summary>JSON 스키마</summary>
                      <pre>{JSON.stringify(c.contentSchema, null, 2)}</pre>
                    </details>
                  </article>
                ))}
              </section>
            )}
            {tab === "handoff" && (
              <section className="panel">
                <h2>승인된 설계를 구현 에이전트에 전달</h2>
                <p>
                  설계 승인은 구현 완료가 아닙니다. 새 초안과 이미 전달한 고정
                  승인 버전을 구분해 사용하세요.
                </p>
                <p>
                  선택한 문서의 revision을 고정해 조회합니다. 이후 초안이
                  변경되어도 이 버전을 다시 가져올 수 있습니다.
                </p>
                {index.documents
                  .filter((d) => d.status === "approved")
                  .map((d) => (
                    <label className="handoff-item" key={d.id}>
                      <input
                        type="checkbox"
                        checked={selected.some(
                          (s) =>
                            s.documentId === d.id && s.revision === d.revision,
                        )}
                        onChange={(e) =>
                          setSelected((previous) =>
                            e.target.checked
                              ? [
                                  ...previous.filter(
                                    (s) => s.documentId !== d.id,
                                  ),
                                  {
                                    documentId: d.id,
                                    revision: d.revision,
                                    title: d.title,
                                  },
                                ]
                              : previous.filter((s) => s.documentId !== d.id),
                          )
                        }
                      />
                      <span>{d.title}</span>
                      <span className="badge scope">{d.scope}</span>
                      <small>r{d.revision}</small>
                    </label>
                  ))}
                {!index.documents.some((d) => d.status === "approved") && (
                  <p className="empty">아직 승인된 문서가 없습니다.</p>
                )}
                {selected.length > 0 && (
                  <section aria-label="선택한 고정 승인 버전">
                    <h3>선택한 고정 승인 버전</h3>
                    {selected.map((selection) => {
                      const current = index.documents.find(
                        (d) => d.id === selection.documentId,
                      );
                      return (
                        <article key={selection.documentId}>
                          <p>
                            {selection.title} · r{selection.revision}
                          </p>
                          {current?.revision !== selection.revision && (
                            <p role="status">
                              현재 문서가 변경되었거나 조회되지 않습니다. 선택한
                              승인 버전 r{selection.revision}을 유지합니다.
                            </p>
                          )}
                          <button
                            onClick={() =>
                              navigate(selection.documentId, selection.revision)
                            }
                          >
                            {selection.title} r{selection.revision} 확인
                          </button>
                          <button
                            onClick={() =>
                              setSelected((previous) =>
                                previous.filter(
                                  (s) => s.documentId !== selection.documentId,
                                ),
                              )
                            }
                          >
                            {selection.title} 선택 해제
                          </button>
                        </article>
                      );
                    })}
                  </section>
                )}
                <button
                  className="primary"
                  disabled={busy || !selected.length}
                  onClick={async () => {
                    const selections = selected.map(
                      ({ documentId, revision }) => ({ documentId, revision }),
                    );
                    const result = await mutate({
                      action: "handoff",
                      projectId,
                      selections,
                    });
                    if (result)
                      setHandoff(
                        JSON.stringify(
                          {
                            tool: "get_handoff",
                            arguments: { projectId, selections },
                            bundle: result,
                          },
                          null,
                          2,
                        ),
                      );
                  }}
                >
                  인계 묶음 만들기
                </button>
                {handoff && (
                  <>
                    <h3>MCP 호출과 고정 설계</h3>
                    <button
                      onClick={async () => {
                        try {
                          if (!navigator.clipboard)
                            throw new Error("Clipboard unavailable");
                          await navigator.clipboard.writeText(handoff);
                        } catch {
                          setError(
                            "이 주소에서는 자동 복사가 제한됩니다. 아래 인계 내용을 선택해 직접 복사하세요.",
                          );
                        }
                      }}
                    >
                      복사
                    </button>
                    <pre>{handoff}</pre>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
