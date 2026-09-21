"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFlowMeasurements } from "./flow-measurements";
import { ReactFlow, Background, Controls, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  Project,
  Document,
  Template,
  FlowNode,
} from "@/entities/planner/model";
import { api, missingAs } from "@/shared/api";
import { DocumentEditor } from "./document-editor";
import { TemplateManager } from "./template-manager";
import { WorkspacePanels } from "./workspace-panels";
import {
  BookOpen,
  FolderGit2,
  Plus,
  Search,
  FileText,
  GitBranch,
  LayoutTemplate,
  Bot,
  ChevronRight,
  Settings2,
  CircleDot,
  Menu,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import { FitDocumentFlow } from "./fit-document-flow";
import { documentFlow } from "./document-flow";
import { CreateDocumentDialog } from "./create-document-dialog";
const phaseLabel = {
  design: "설계",
  implementation: "구현",
  verification: "검증",
};
type Detail = Document & {
  children: { id: string; title: string; kind: string }[];
};
export function Workspace({ guide }: { guide?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeProjectId = pathname.startsWith("/projects/")
    ? decodeURIComponent(pathname.split("/")[2] ?? "")
    : "";
  const tab =
    pathname === "/templates"
      ? "templates"
      : pathname === "/ai-workflow"
        ? "rules"
        : pathname === "/mcp-guide"
          ? "guide"
          : "workspace";
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projectId, setProjectId] = useState(routeProjectId);
  const [documents, setDocuments] = useState<Document[]>([]);
  const { measurements, recordMeasurements } = useFlowMeasurements();
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [nodeCoordinates, setNodeCoordinates] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [documentId, setDocumentId] = useState("");
  const [document, setDocument] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDialog, setProjectDialog] = useState<
    "create" | "rename" | "delete" | null
  >(null);
  const [dialogError, setDialogError] = useState("");
  const [createParent, setCreateParent] = useState<Document | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [phase, setPhase] = useState<Document["phase"]>("design");
  const [selectedNode, setSelectedNode] = useState("");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeDocument, setNodeDocument] = useState("");
  const autoSelectProject = useRef(routeProjectId);
  const mobileNavigationTrigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const selection = useRef({ projectId: routeProjectId, documentId: "" });
  const refresh = useCallback(async () => {
    if (
      selection.current.projectId !== projectId ||
      selection.current.documentId !== documentId
    )
      return;
    const ticket = ++generation.current;
    try {
      const [p, t, d, n, detail] = await Promise.all([
        api<Project[]>("projects"),
        api<Template[]>("templates"),
        projectId
          ? api<Document[]>(`documents?projectId=${projectId}`).catch(
              missingAs<Document[]>([]),
            )
          : Promise.resolve([]),
        projectId
          ? api<FlowNode[]>(`projects/${projectId}/nodes`).catch(
              missingAs<FlowNode[]>([]),
            )
          : Promise.resolve([]),
        documentId
          ? api<Detail>(`documents/${documentId}`).catch(
              missingAs<Detail | null>(null),
            )
          : Promise.resolve(null),
      ]);
      if (
        ticket !== generation.current ||
        selection.current.projectId !== projectId ||
        selection.current.documentId !== documentId
      )
        return;
      setProjects(p);
      setTemplates(t);
      setDocuments(d);
      setNodes(n);
      setDocument(detail);
      if (autoSelectProject.current === projectId && projectId && !documentId) {
        autoSelectProject.current = "";
        const index = d.find(
          (item) => item.kind === "index" && item.phase === "design",
        );
        if (index) {
          selection.current.documentId = index.id;
          setDocumentId(index.id);
        }
      }
      if (projectId && !p.some((project) => project.id === projectId)) {
        selection.current = { projectId: "", documentId: "" };
        setProjectId("");
        setDocumentId("");
        if (pathname.startsWith("/projects/")) router.replace("/");
      } else if (documentId && !detail) {
        selection.current.documentId = "";
        setDocumentId("");
      }
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    }
  }, [projectId, documentId, pathname, router]);
  useEffect(() => {
    // Initial async fetch and SSE share the same stale-response guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const events = new EventSource("/api/events");
    events.addEventListener("change", refresh);
    return () => {
      // Invalidate outstanding requests when selection changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      events.close();
    };
  }, [refresh]);
  async function run(task: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await task();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const resetProject = useCallback((id: string) => {
    autoSelectProject.current = id;
    selection.current = { projectId: id, documentId: "" };
    setProjectId(id);
    setDocumentId("");
    setDocument(null);
    setDocuments([]);
    setNodes([]);
    setNodeCoordinates({});
    setSelectedNode("");
    setPhase("design");
    setDocumentSearch("");
    setEditorDirty(false);
  }, []);
  useEffect(() => {
    if (
      (pathname === "/" || pathname.startsWith("/projects/")) &&
      routeProjectId !== projectId
    ) {
      // URL navigation (including browser history) controls project selection.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetProject(routeProjectId);
    }
  }, [pathname, routeProjectId, projectId, resetProject]);
  function selectProject(id: string) {
    const href = id ? `/projects/${encodeURIComponent(id)}` : "/";
    if (pathname !== href) router.push(href);
    else if (!id) resetProject("");
  }
  function selectDocument(id: string) {
    if (id === documentId) return;
    setEditorDirty(false);
    const next = documents.find((d) => d.id === id);
    if (next) setPhase(next.phase);
    selection.current.documentId = id;
    setDocumentId(id);
    setDocument(null);
  }
  function navigate(action: () => void) {
    if (editorDirty) setPendingNavigation(() => action);
    else action();
  }
  function openProject(id: string) {
    navigate(() => {
      setMobileNavigationOpen(false);
      selectProject(id);
    });
  }
  function openDocument(id: string) {
    if (id !== documentId) navigate(() => selectDocument(id));
  }
  function choosePhase(value: string) {
    navigate(() => {
      const nextPhase = value as Document["phase"];
      setPhase(nextPhase);
      const index = documents.find(
        (d) => d.kind === "index" && d.phase === nextPhase,
      );
      if (index) selectDocument(index.id);
    });
  }
  const selectedProject = projects.find((p) => p.id === projectId);
  const phaseIndex = documents.find(
    (d) => d.kind === "index" && d.phase === phase,
  );
  const phaseDocuments = documents.filter(
    (d) =>
      d.phase === phase ||
      (phase === "verification" && d.kind === "design-verification"),
  );
  const orderedDocuments: Document[] = [];
  const visited = new Set<string>();
  function visitDocument(item: Document) {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    orderedDocuments.push(item);
    phaseDocuments.filter((d) => d.parentId === item.id).forEach(visitDocument);
  }
  phaseDocuments
    .filter((d) => !phaseDocuments.some((parent) => parent.id === d.parentId))
    .forEach(visitDocument);
  phaseDocuments.forEach(visitDocument);
  const visibleDocuments = orderedDocuments.filter((d) =>
    d.title.toLowerCase().includes(documentSearch.trim().toLowerCase()),
  );
  function depth(d: Document) {
    let parent = d.parentId;
    let level = 0;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      level++;
      parent = documents.find((item) => item.id === parent)?.parentId ?? null;
    }
    return Math.min(level, 4);
  }
  function beginCreate(parent: Document) {
    navigate(() => setCreateParent(parent));
  }
  const subtree = documentFlow(nodes, documents, nodeCoordinates);
  function projectNavigation(mobile = false) {
    return (
      <>
        <div className="sidebar-content">
          <div className="sidebar-heading">
            <h2>프로젝트</h2>
            <Badge variant="secondary">{projects.length}</Badge>
          </div>
          <Button
            className="new-project-button"
            onClick={() => {
              navigate(() => {
                if (mobile) setMobileNavigationOpen(false);
                setProjectTitle("");
                setDialogError("");
                setProjectDialog("create");
              });
            }}
          >
            <Plus size={16} />새 프로젝트
          </Button>
          <label className="search-field">
            <span className="sr-only">프로젝트 검색</span>
            <Search size={15} />
            <Input
              placeholder="프로젝트 검색"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
            />
          </label>
          <div className="project-list">
            {projects
              .filter((p) =>
                p.title.toLowerCase().includes(projectSearch.toLowerCase()),
              )
              .map((p) => (
                <Button
                  variant="ghost"
                  aria-label={p.title}
                  aria-pressed={projectId === p.id}
                  key={p.id}
                  onClick={() => openProject(p.id)}
                >
                  <FolderGit2 size={16} />
                  <span>{p.title}</span>
                </Button>
              ))}
          </div>
          {projects.length === 0 && (
            <p className="muted sidebar-hint">
              프로젝트를 만들면 설계·구현·검증 문서가 준비됩니다.
            </p>
          )}
          {selectedProject && (
            <div className="project-settings">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings2 size={15} />
                    프로젝트 설정
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() => {
                      if (mobile) setMobileNavigationOpen(false);
                      setProjectTitle(selectedProject.title);
                      setDialogError("");
                      setProjectDialog("rename");
                    }}
                  >
                    이름 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      if (mobile) setMobileNavigationOpen(false);
                      setDialogError("");
                      setProjectDialog("delete");
                    }}
                  >
                    프로젝트 삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="sidebar-footer">
          <Button variant="ghost" asChild>
            <Link
              href="/mcp-guide"
              prefetch={false}
              onNavigate={(event) => {
                if (pathname !== "/mcp-guide" && editorDirty) {
                  event.preventDefault();
                  navigate(() => router.push("/mcp-guide"));
                }
                if (mobile) setMobileNavigationOpen(false);
              }}
              aria-current={tab === "guide" ? "page" : undefined}
            >
              <Bot size={16} />
              AI MCP Interface 안내
            </Link>
          </Button>
        </div>
      </>
    );
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Link
            href="/"
            className="brand-home"
            aria-label="Planner 메인 화면"
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              navigate(() => {
                selectProject("");
              });
            }}
          >
            <span className="brand-mark">
              <GitBranch size={23} />
            </span>
            <strong>Planner</strong>
          </Link>
          <span className="brand-divider">/</span>
          <span className="topbar-project">
            {selectedProject?.title ?? "Workspace"}
          </span>
        </div>
        <nav aria-label="주요 메뉴">
          {[
            {
              href: projectId
                ? `/projects/${encodeURIComponent(projectId)}`
                : "/",
              label: "작업 공간",
              icon: BookOpen,
            },
            { href: "/templates", label: "템플릿 관리", icon: LayoutTemplate },
            { href: "/ai-workflow", label: "AI 작업 안내", icon: Bot },
          ].map(({ href, label, icon: Icon }) => (
            <Button key={href} variant="ghost" asChild>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                onNavigate={(event) => {
                  if (pathname !== href && editorDirty) {
                    event.preventDefault();
                    navigate(() => router.push(href));
                  }
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            </Button>
          ))}
        </nav>
        <Button
          className="mobile-project-trigger"
          variant="outline"
          aria-label="프로젝트 메뉴 열기"
          aria-haspopup="dialog"
          aria-expanded={mobileNavigationOpen}
          ref={mobileNavigationTrigger}
          onClick={() => setMobileNavigationOpen(true)}
        >
          <Menu size={18} />
          <span>{selectedProject?.title ?? "프로젝트"}</span>
        </Button>
      </header>
      <Dialog
        open={mobileNavigationOpen}
        onOpenChange={(open) => {
          setMobileNavigationOpen(open);
          if (!open)
            requestAnimationFrame(() =>
              mobileNavigationTrigger.current?.focus(),
            );
        }}
      >
        <DialogContent
          className="mobile-navigation-drawer"
          closeLabel="프로젝트 메뉴 닫기"
        >
          <DialogHeader>
            <DialogTitle>프로젝트 탐색</DialogTitle>
            <DialogDescription>
              프로젝트를 선택하거나 새 작업 공간을 만드세요.
            </DialogDescription>
          </DialogHeader>
          <aside className="mobile-drawer-sidebar" aria-label="프로젝트 탐색">
            {projectNavigation(true)}
          </aside>
          <DialogClose asChild>
            <Button className="mobile-drawer-done" variant="outline">
              현재 화면으로 돌아가기
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      {error && (
        <div className="global-error" role="alert">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError("");
              void refresh();
            }}
          >
            다시 조회
          </Button>
        </div>
      )}
      <div className="shell">
        <aside className="sidebar" aria-label="프로젝트 탐색">
          {projectNavigation()}
        </aside>
        <main>
          {tab === "guide" ? (
            guide
          ) : tab === "templates" ? (
            <TemplateManager
              key={editorEpoch}
              templates={templates}
              onRefresh={refresh}
              onDirtyChange={setEditorDirty}
            />
          ) : tab === "rules" ? (
            <Rules />
          ) : !selectedProject ? (
            <section className="welcome">
              <span className="welcome-icon">
                <FolderGit2 size={32} />
              </span>
              <p className="eyebrow">YOUR PROJECT WORKSPACE</p>
              <h1>
                설계부터 검증까지,
                <br />한 곳에서 이어가세요.
              </h1>
              <p>
                프로젝트를 선택하거나 새로 만드세요.
                <br />
                단계별 index에서 문서를 만들고, AI와 함께 진행을 확인합니다.
              </p>
              <Button
                onClick={() => {
                  navigate(() => {
                    setProjectTitle("");
                    setDialogError("");
                    setProjectDialog("create");
                  });
                }}
              >
                <Plus size={16} />첫 프로젝트 만들기
              </Button>
              <div className="onboarding-steps">
                {[
                  [
                    "01",
                    "프로젝트 만들기",
                    "설계·구현·검증 index가 자동 준비됩니다.",
                  ],
                  [
                    "02",
                    "하위 문서 작성",
                    "index의 하위 문서 만들기에서 시작하세요.",
                  ],
                  [
                    "03",
                    "AI와 검증하기",
                    "AI 결과와 사람 확인을 함께 관리하세요.",
                  ],
                ].map(([n, title, description]) => (
                  <Card key={n}>
                    <CardContent>
                      <span className="step-number">{n}</span>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : (
            <WorkspacePanels
              revealKey={documentId}
              canvas={
                <section className="canvas-panel">
                  <div className="workspace-title">
                    <div>
                      <p className="eyebrow">
                        <FolderGit2 size={14} /> PROJECT
                      </p>
                      <h1>{selectedProject.title}</h1>
                    </div>
                    <Badge variant="secondary">
                      문서 {documents.filter((d) => d.kind !== "index").length}
                      개
                    </Badge>
                  </div>
                  <div className="section-heading">
                    <h2>
                      <GitBranch size={16} />
                      프로젝트 흐름
                    </h2>
                    <span className="muted">
                      노드를 선택하거나 드래그하세요
                    </span>
                  </div>
                  <div
                    className={`flow ${subtree.nodes.length ? "flow-with-documents" : ""}`}
                  >
                    <ReactFlow
                      nodes={[
                        ...nodes.map((n, i) => ({
                          id: n.id,
                          measured: measurements[n.id],
                          position: nodeCoordinates[n.id] ??
                            n.coordinates ?? { x: 30 + i * 240, y: 80 },
                          sourcePosition: Position.Right,
                          targetPosition: Position.Left,
                          data: {
                            label: (
                              <div>
                                <b>
                                  <FolderGit2 size={16} aria-hidden="true" />{" "}
                                  {phaseLabel[n.phase]}
                                </b>
                                <br />
                                {n.label}
                              </div>
                            ),
                          },
                          selected: n.id === selectedNode,
                        })),
                        ...subtree.nodes.map((n) => ({
                          ...n,
                          measured: measurements[n.id],
                          data: {
                            ...n.data,
                            label: (
                              <div
                                className="flow-document-label"
                                title={String(n.data.label)}
                              >
                                <FileText size={18} aria-hidden="true" />
                                <span>{String(n.data.label)}</span>
                              </div>
                            ),
                          },
                          selected: n.data.documentId === documentId,
                        })),
                      ]}
                      edges={subtree.edges}
                      onNodeClick={(_, n) => {
                        const child = subtree.nodes.find(
                          (item) => item.id === n.id,
                        );
                        if (child) {
                          openDocument(String(child.data.documentId));
                          return;
                        }
                        const node = nodes.find((x) => x.id === n.id);
                        if (!node) return;
                        navigate(() => {
                          setSelectedNode(node.id);
                          setNodeLabel(node.label);
                          setNodeDocument(node.documentId ?? "");
                          setPhase(node.phase);
                          if (node.documentId) selectDocument(node.documentId);
                        });
                      }}
                      onNodesChange={(changes) => {
                        recordMeasurements(changes);
                        const moved = changes.filter(
                          (change) =>
                            change.type === "position" && change.position,
                        );
                        if (!moved.length) return;
                        setNodeCoordinates((current) => {
                          const next = { ...current };
                          for (const change of moved) {
                            if (change.type === "position" && change.position)
                              next[change.id] = change.position;
                          }
                          return next;
                        });
                      }}
                      onNodeDragStop={(_, moved) => {
                        const node = nodes.find((n) => n.id === moved.id);
                        if (!node) return;
                        void run(async () => {
                          await api(
                            `projects/${projectId}/nodes/${node.id}`,
                            "PATCH",
                            {
                              label: node.label,
                              phase: node.phase,
                              documentId: node.documentId,
                              position: node.position,
                              coordinates: moved.position,
                            },
                          );
                        }).finally(() => {
                          setNodeCoordinates((current) => {
                            const next = { ...current };
                            delete next[moved.id];
                            return next;
                          });
                        });
                      }}
                      nodesDraggable={!busy}
                      deleteKeyCode={null}
                      multiSelectionKeyCode={null}
                      nodesConnectable={false}
                      fitView
                    >
                      <FitDocumentFlow
                        structure={subtree.edges
                          .map((edge) => `${edge.source}:${edge.target}`)
                          .join("|")}
                      />
                      <Background />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </div>
                  <details>
                    <summary>흐름 노드 관리</summary>
                    <p className="muted">
                      캔버스에서 노드를 선택해 이름과 연결 문서를 수정하세요.
                    </p>
                    <label>
                      노드 이름
                      <Input
                        value={nodeLabel}
                        onChange={(e) => setNodeLabel(e.target.value)}
                      />
                    </label>
                    <label>
                      노드 연결 문서
                      <select
                        value={nodeDocument}
                        onChange={(e) => setNodeDocument(e.target.value)}
                      >
                        <option value="">연결 없음</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="actions">
                      <Button
                        disabled={!selectedNode || !nodeLabel || busy}
                        onClick={() =>
                          run(async () => {
                            await api(
                              `projects/${projectId}/nodes/${selectedNode}`,
                              "PATCH",
                              {
                                label: nodeLabel,
                                phase,
                                documentId: nodeDocument || null,
                                position:
                                  nodes.find((n) => n.id === selectedNode)
                                    ?.position ?? 0,
                              },
                            );
                          })
                        }
                      >
                        노드 수정
                      </Button>
                    </div>
                  </details>

                  <div className="document-browser">
                    <div className="section-heading">
                      <h2>
                        <BookOpen size={17} />
                        문서 카탈로그
                      </h2>
                      <Button
                        size="sm"
                        disabled={!phaseIndex}
                        onClick={() => phaseIndex && beginCreate(phaseIndex)}
                      >
                        <Plus size={15} />새 문서
                      </Button>
                    </div>
                    <Tabs value={phase} onValueChange={choosePhase}>
                      <TabsList aria-label="단계">
                        {Object.entries(phaseLabel).map(([value, label]) => (
                          <TabsTrigger value={value} key={value}>
                            {label}
                            <span className="tab-count">
                              {
                                documents.filter((d) => d.phase === value)
                                  .length
                              }
                            </span>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <label className="search-field">
                      <span className="sr-only">문서 검색</span>
                      <Search size={15} />
                      <Input
                        value={documentSearch}
                        onChange={(e) => setDocumentSearch(e.target.value)}
                        placeholder="문서 검색"
                      />
                    </label>
                    <div className="document-list">
                      {visibleDocuments.map((d) => (
                        <Button
                          variant="ghost"
                          key={d.id}
                          aria-label={`${d.title} ${d.status}`}
                          aria-pressed={documentId === d.id}
                          onClick={() => openDocument(d.id)}
                          style={{ paddingLeft: 12 + depth(d) * 14 }}
                        >
                          {d.kind === "index" ? (
                            <FolderGit2 size={16} />
                          ) : (
                            <FileText size={16} />
                          )}
                          <span className="document-title">{d.title}</span>
                          <span
                            className={`document-status status-${d.status}`}
                            title={d.status}
                          >
                            <CircleDot size={12} />
                            {
                              {
                                draft: "초안",
                                "in-progress": "진행 중",
                                verified: "검증 완료",
                                reopen: "재검증",
                              }[d.status]
                            }
                          </span>
                        </Button>
                      ))}
                    </div>
                    {!visibleDocuments.length && (
                      <p className="list-empty">검색 결과가 없습니다.</p>
                    )}
                    <p className="catalog-help">
                      index를 열면 하위 문서를 만들고 진행 상태를 확인할 수
                      있습니다.
                    </p>
                  </div>
                </section>
              }
              detail={
                <aside className="detail-panel">
                  {document ? (
                    <DocumentEditor
                      key={`${document.id}:${editorEpoch}`}
                      document={document}
                      documents={documents}
                      onRefresh={refresh}
                      onOpen={openDocument}
                      onDelete={() => selectDocument("")}
                      onCreateChild={beginCreate}
                      onDirtyChange={setEditorDirty}
                    />
                  ) : (
                    <div className="empty">
                      <FileText size={36} />
                      <h2>
                        {documentId
                          ? "문서를 불러오는 중…"
                          : "어디서 시작할까요?"}
                      </h2>
                      <p>
                        단계별 index에서 하위 문서를 만들고
                        <br />
                        설계와 진행 상황을 정리하세요.
                      </p>
                      {phaseIndex && (
                        <Button
                          variant="outline"
                          onClick={() => openDocument(phaseIndex.id)}
                        >
                          {phaseLabel[phase]} index 열기
                          <ChevronRight size={15} />
                        </Button>
                      )}
                    </div>
                  )}
                </aside>
              }
            />
          )}
        </main>
      </div>
      {createParent && (
        <CreateDocumentDialog
          key={createParent.id}
          parent={createParent}
          projectTitle={selectedProject?.title ?? ""}
          templates={templates}
          onClose={() => setCreateParent(null)}
          onCreated={(d) => {
            setCreateParent(null);
            setPhase(d.phase);
            selectDocument(d.id);
            void refresh();
          }}
        />
      )}
      <Dialog
        open={projectDialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setProjectDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {projectDialog === "create"
                ? "새 프로젝트"
                : projectDialog === "rename"
                  ? "프로젝트 이름 변경"
                  : "프로젝트 삭제"}
            </DialogTitle>
            <DialogDescription>
              {projectDialog === "delete"
                ? "프로젝트와 포함된 모든 문서를 삭제합니다. 이 작업은 되돌릴 수 없습니다."
                : "설계·구현·검증을 하나의 프로젝트에서 관리합니다."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setDialogError("");
              try {
                if (projectDialog === "create") {
                  const p = await api<Project>("projects", "POST", {
                    title: projectTitle.trim(),
                  });
                  setProjects((current) => [...current, p]);
                  selectProject(p.id);
                } else if (projectDialog === "rename") {
                  await api(`projects/${projectId}`, "PATCH", {
                    title: projectTitle.trim(),
                  });
                  await refresh();
                } else {
                  await api(`projects/${projectId}`, "DELETE", {});
                  selectProject("");
                }
                setProjectDialog(null);
              } catch (e) {
                setDialogError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {dialogError && <p role="alert">{dialogError}</p>}
            {projectDialog !== "delete" && (
              <label>
                {projectDialog === "create"
                  ? "새 프로젝트 이름"
                  : "프로젝트 이름"}
                <Input
                  required
                  autoFocus
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  maxLength={160}
                  placeholder="예: 고객 포털 리뉴얼"
                />
              </label>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProjectDialog(null)}
                disabled={busy}
              >
                취소
              </Button>
              <Button
                variant={projectDialog === "delete" ? "destructive" : "default"}
                type="submit"
                disabled={
                  busy || (projectDialog !== "delete" && !projectTitle.trim())
                }
              >
                {projectDialog === "create"
                  ? "프로젝트 만들기"
                  : projectDialog === "rename"
                    ? "이름 저장"
                    : "삭제"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pendingNavigation}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>저장하지 않은 변경 사항</DialogTitle>
            <DialogDescription>
              문서에 저장하지 않은 내용이 있습니다. 이동하면 이 내용은
              사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingNavigation(null)}
            >
              계속 편집
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const action = pendingNavigation;
                setPendingNavigation(null);
                setEditorDirty(false);
                setEditorEpoch((value) => value + 1);
                action?.();
              }}
            >
              변경 버리고 이동
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Rules() {
  const [rules, setRules] = useState<{ steps: string[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ steps: string[] }>("workflow")
      .then(setRules)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="template-manager">
      <h1>AI 작업 안내</h1>
      {error && <p role="alert">{error}</p>}
      <p>
        연결된 AI 도구에서 구현을 요청하세요. Planner는 작업 문서와 상태를
        제공합니다.
      </p>
      <ol>
        {rules?.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </section>
  );
}
