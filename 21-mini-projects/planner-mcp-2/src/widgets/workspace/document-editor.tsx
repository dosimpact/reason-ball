"use client";
import { useState, useEffect, useId } from "react";
import type { Document } from "@/entities/planner/model";
import {
  MarkdownView,
  ChecklistView,
  OverviewTree,
} from "@/entities/planner/document-view";
import { api } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { ArrowUp, FileText, Plus } from "lucide-react";
import { DocumentExtensions } from "./document-extensions";
import { MarkdownEditor } from "./markdown-editor";
import { OverviewEditor } from "./overview-editor";
type Detail = Document & {
  children: { id: string; title: string; kind: string }[];
};
export function DocumentEditor({
  document,
  documents,
  onRefresh,
  onOpen,
  onDelete,
  onCreateChild,
  onDirtyChange,
}: {
  document: Detail;
  documents: Document[];
  onRefresh: () => Promise<void>;
  onOpen: (id: string) => void;
  onDelete: () => void;
  onCreateChild?: (parent: Document) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const checklistHeadingId = useId();
  const [draft, setDraft] = useState({
    title: document.title,
    body: document.body,
    overview: document.overview,
    extensions: document.extensions ?? [],
    revision: document.revision,
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState("");
  const [confirmation, setConfirmation] = useState<"reload" | "delete" | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const parent = documents.find((item) => item.id === document.parentId);
  const kindLabels: Record<string, string> = {
    index: "단계 안내",
    "design-verification": "설계 · 검증",
    implementation: "구현",
    overview: "비즈니스 흐름",
    "verification-result": "AI 검증 결과",
  };
  const statusLabels = {
    draft: "초안",
    "in-progress": "진행 중",
    verified: "검증 완료",
    reopen: "재검증 필요",
  };
  useEffect(() => {
    if (!dirty) {
      // Preserve unsaved edits across SSE refresh; their original revision detects conflicts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({
        title: document.title,
        body: document.body,
        overview: document.overview,
        extensions: document.extensions ?? [],
        revision: document.revision,
      });
    }
  }, [document, dirty]);
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const base = `documents/${document.id}`;
  return (
    <section className="document-editor">
      {parent && (
        <Button
          variant="ghost"
          size="sm"
          className="parent-document-link"
          onClick={() => onOpen(parent.id)}
        >
          <ArrowUp size={14} />
          {parent.title}
        </Button>
      )}
      <header className="document-heading">
        <div className="document-heading-meta">
          <Badge variant="secondary">{kindLabels[document.kind]}</Badge>
          <span className="muted">revision {document.revision}</span>
        </div>
        <h2>{document.title}</h2>
        <Badge className={document.status}>
          {statusLabels[document.status]}
        </Badge>
      </header>
      <Card className="child-document-section">
        <CardHeader className="section-heading-row">
          <div>
            <CardTitle role="heading" aria-level={3}>
              하위 문서 카탈로그{" "}
              <span className="muted" aria-hidden="true">
                {document.children.length}
              </span>
            </CardTitle>
            <CardDescription>
              {document.kind === "index"
                ? "이 단계에서 필요한 문서를 만들고 작업을 시작하세요."
                : "이 문서에 연결된 세부 설계와 결과를 관리하세요."}
            </CardDescription>
          </div>
          {onCreateChild && (
            <Button size="sm" onClick={() => onCreateChild(document)}>
              <Plus size={15} />
              하위 문서 만들기
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {document.children.length ? (
            <div className="child-document-list">
              {document.children.map((child) => {
                const childDocument = documents.find(
                  (item) => item.id === child.id,
                );
                return (
                  <Button
                    variant="ghost"
                    className="catalog-link"
                    key={child.id}
                    onClick={() => onOpen(child.id)}
                  >
                    <FileText size={16} />
                    <span className="catalog-title">{child.title}</span>
                    <span className="catalog-kind muted">
                      {kindLabels[child.kind] ?? child.kind}
                    </span>
                    {childDocument && (
                      <Badge variant="secondary">
                        {statusLabels[childDocument.status]}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="child-empty-state">
              <FileText size={24} />
              <p>하위 문서가 없습니다.</p>
              <span className="muted">
                위의 ‘하위 문서 만들기’에서 템플릿을 선택해 시작하세요.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="document-section-heading">
        <h3>문서 편집</h3>
        {dirty && <Badge variant="secondary">저장하지 않은 변경</Badge>}
      </div>
      {error && <p role="alert">{error}</p>}
      {dirty && draft.revision !== document.revision && (
        <p role="alert">
          다른 작업에서 문서가 변경되었습니다. 입력을 복사한 뒤 최신 내용
          불러오기를 사용하세요.
        </p>
      )}
      <label>
        문서 제목
        <Input
          value={draft.title}
          onChange={(e) => {
            setDirty(true);
            setDraft({ ...draft, title: e.target.value });
          }}
        />
      </label>
      <MarkdownEditor
        label="문서 본문"
        value={draft.body}
        onChange={(body) => {
          setDirty(true);
          setDraft({ ...draft, body });
        }}
      />
      {document.kind === "overview" && (
        <OverviewEditor
          entries={draft.overview}
          documents={documents}
          onChange={(overview) => {
            setDirty(true);
            setDraft({ ...draft, overview });
          }}
        />
      )}
      <DocumentExtensions
        extensions={draft.extensions}
        disabled={busy}
        onChange={(extensions) => {
          setDirty(true);
          setDraft({ ...draft, extensions });
        }}
      />
      <div className="actions">
        <Button
          variant="default"
          disabled={busy || !dirty}
          onClick={() =>
            run(async () => {
              await api(base, "PATCH", {
                title: draft.title,
                body: draft.body,
                extensions: draft.extensions,
                ...(document.kind === "overview"
                  ? { overview: draft.overview }
                  : {}),
                expectedRevision: draft.revision,
              });
              setDirty(false);
              setSaved(true);
            })
          }
        >
          문서 저장
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (dirty) setConfirmation("reload");
            else void onRefresh();
          }}
        >
          최신 내용 불러오기
        </Button>
        {document.kind !== "index" && (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setConfirmation("delete");
            }}
          >
            문서 삭제
          </Button>
        )}
      </div>
      {saved && !dirty && (
        <p role="status" className="save-feedback">
          문서를 저장했습니다.
        </p>
      )}
      <h3>미리보기</h3>
      <MarkdownView body={document.body} />
      {document.kind === "overview" && (
        <OverviewTree entries={document.overview} onOpen={onOpen} />
      )}
      <section
        className={
          document.kind === "index" ? "index-progress-section" : undefined
        }
        aria-labelledby={checklistHeadingId}
      >
        <h3 id={checklistHeadingId}>진행 체크리스트</h3>
        {document.kind === "index" && (
          <p className="muted">
            이 단계의 진행 상태를 관리하는 체크리스트입니다.
          </p>
        )}
        <ChecklistView
          items={document.checklist}
          busy={busy}
          onConfirm={(item) =>
            run(() =>
              api(`${base}/checklist/${item.id}/confirm`, "POST", {
                confirmed: !item.humanConfirmed,
                expectedRevision: document.revision,
              }),
            )
          }
          onReopen={(item) =>
            run(() =>
              api(`${base}/reopen`, "POST", {
                affectedItemIds: [item.id],
                reason: "사람이 재검증 요청",
                expectedRevision: document.revision,
              }),
            )
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`${base}/checklist`, "POST", {
                label,
                expectedRevision: document.revision,
              });
              setLabel("");
            });
          }}
        >
          <label>
            새 체크리스트 항목
            <Input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            disabled={busy || !label.trim()}
          >
            항목 추가
          </Button>
        </form>
        <details>
          <summary>체크리스트 항목 편집</summary>
          {document.checklist.map((item) => (
            <div className="actions" key={item.id}>
              <span>{item.label}</span>
              <Button
                disabled={busy}
                onClick={() => {
                  setEditingItem({ id: item.id, label: item.label });
                }}
              >
                설명 수정
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    api(`${base}/checklist/${item.id}`, "DELETE", {
                      expectedRevision: document.revision,
                    }),
                  )
                }
              >
                항목 삭제
              </Button>
            </div>
          ))}
        </details>
      </section>
      {document.kind === "design-verification" && (
        <details>
          <summary>AI 검증 결과 기록</summary>
          <p className="muted">
            AI는 MCP로 이 기록을 갱신합니다. 수동 기록도 가능합니다.
          </p>
          <label>
            검증 결과 본문
            <Textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || !result.trim()}
            onClick={() =>
              run(() =>
                api(`${base}/verification`, "POST", {
                  body: result,
                  expectedRevision: document.revision,
                }),
              )
            }
          >
            결과 문서 갱신
          </Button>
        </details>
      )}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation === "delete"
                ? "문서를 삭제할까요?"
                : "최신 내용을 불러올까요?"}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "delete"
                ? "이 문서와 모든 하위 문서가 삭제됩니다. 삭제한 문서는 복구할 수 없습니다."
                : "저장하지 않은 변경을 버리고 최신 문서를 불러옵니다."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              취소
            </Button>
            <Button
              variant={confirmation === "delete" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => {
                const action = confirmation;
                setConfirmation(null);
                if (action === "reload") {
                  setDirty(false);
                  void onRefresh();
                } else
                  void run(async () => {
                    await api(base, "DELETE", {
                      expectedRevision: document.revision,
                    });
                    onDelete();
                  });
              }}
            >
              {confirmation === "delete" ? "삭제하기" : "불러오기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>체크리스트 설명 수정</DialogTitle>
            <DialogDescription>
              항목 설명을 바꾸면 해당 항목의 검증 상태가 초기화됩니다.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!editingItem?.label.trim()) return;
              void run(async () => {
                await api(`${base}/checklist/${editingItem.id}`, "PATCH", {
                  label: editingItem.label,
                  expectedRevision: document.revision,
                });
                setEditingItem(null);
              });
            }}
          >
            <label>
              항목 설명
              <Input
                required
                value={editingItem?.label ?? ""}
                onChange={(event) =>
                  setEditingItem((item) =>
                    item ? { ...item, label: event.target.value } : item,
                  )
                }
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingItem(null)}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={busy || !editingItem?.label.trim()}
              >
                설명 저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
