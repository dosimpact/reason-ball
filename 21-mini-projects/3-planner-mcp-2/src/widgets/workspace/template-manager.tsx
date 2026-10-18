"use client";
import { useEffect, useState } from "react";
import type { Template, TemplateInput } from "@/entities/planner/model";
import { DocumentExtensions } from "./document-extensions";
import { MarkdownEditor } from "./markdown-editor";
import { TemplatePreview } from "./template-preview";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import { Plus, Save, FileText, Trash2 } from "lucide-react";
import { api } from "@/shared/api";
const blank: TemplateInput = {
  name: "",
  title: "",
  kind: "design-verification",
  body: "",
  example: "",
  prompt: "",
  checklist: [],
};
function snapshot(draft: TemplateInput, checks: string) {
  return JSON.stringify([
    draft.name,
    draft.title,
    draft.kind,
    draft.body,
    draft.example,
    draft.prompt,
    checks,
    draft.extensions ?? [],
  ]);
}
export function TemplateManager({
  templates,
  onRefresh,
  onDirtyChange,
}: {
  templates: Template[];
  onRefresh: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<TemplateInput>(blank);
  const [revision, setRevision] = useState<number>();
  const [checks, setChecks] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(() => snapshot(blank, ""));
  const [pendingTemplate, setPendingTemplate] = useState<
    Template | null | undefined
  >(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dirty = snapshot(draft, checks) !== baseline;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  function selectTemplate(template: Template | null) {
    const data: TemplateInput = template
      ? {
          name: template.name,
          title: template.title,
          kind: template.kind,
          body: template.body,
          example: template.example,
          prompt: template.prompt,
          checklist: template.checklist,
          extensions: template.extensions ?? [],
        }
      : blank;
    const nextChecks = data.checklist.join("\n");
    setDraft(data);
    setChecks(nextChecks);
    setRevision(template?.revision);
    setBaseline(snapshot(data, nextChecks));
    setSaved(false);
    setError("");
    setPendingTemplate(undefined);
  }
  function requestTemplate(template: Template | null) {
    if (template && revision && draft.name === template.name) return;
    if (dirty) setPendingTemplate(template);
    else selectTemplate(template);
  }
  async function removeTemplate() {
    setDeleteOpen(false);
    setBusy(true);
    setError("");
    try {
      await api(`templates/${draft.name}`, "DELETE", {});
      selectTemplate(null);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const submitted = snapshot(draft, checks);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result = await api<Template>(
        revision ? `templates/${draft.name}` : "templates",
        revision ? "PATCH" : "POST",
        {
          ...draft,
          checklist: checks
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          ...(revision ? { expectedRevision: revision } : {}),
        },
      );
      setRevision(result.revision);
      setBaseline(submitted);
      await onRefresh();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="template-manager">
      <header className="page-heading">
        <div>
          <span className="eyebrow">TEMPLATES</span>
          <h2>문서 템플릿 관리</h2>
          <p className="muted">
            문서를 시작할 양식과 AI 작성 지침을 관리합니다. 변경 사항은 새로
            만드는 문서에 적용됩니다.
          </p>
        </div>
      </header>
      <div className="template-layout">
        <aside className="template-library" aria-label="템플릿 목록">
          <Button disabled={busy} onClick={() => requestTemplate(null)}>
            <Plus size={16} /> 새 템플릿
          </Button>
          <p className="muted">저장된 템플릿 · {templates.length}</p>
          {templates.map((t) => (
            <Button
              key={t.name}
              variant="ghost"
              className={`template-choice ${revision && draft.name === t.name ? "active" : ""}`}
              aria-pressed={!!revision && draft.name === t.name}
              disabled={busy}
              onClick={() => requestTemplate(t)}
            >
              <FileText size={16} />
              <span>{t.title}</span>
            </Button>
          ))}
        </aside>
        <div className="template-editor">
          <header className="template-editor-header">
            <div>
              <h3>{revision ? draft.title : "새 템플릿 만들기"}</h3>
              <p className="muted">
                {revision
                  ? `저장된 버전 ${revision}`
                  : "이름과 제목을 정하고 문서의 기본 내용을 작성하세요."}
              </p>
            </div>
            <TemplatePreview
              extensions={draft.extensions}
              title={draft.title}
              body={draft.body}
              example={draft.example}
            />
          </header>
          {error && <p role="alert">{error}</p>}
          <form
            onChange={() => setSaved(false)}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="template-form-grid">
              <label>
                템플릿 이름
                <Input
                  required
                  pattern="[a-z0-9][a-z0-9-]*"
                  placeholder="예: feature-design"
                  disabled={!!revision}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                템플릿 제목
                <Input
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label>
                문서 종류
                <select
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value as TemplateInput["kind"],
                    })
                  }
                >
                  <option value="design-verification">설계-검증</option>
                  <option value="implementation">구현</option>
                  <option value="overview">Overview</option>
                </select>
              </label>
            </div>
            <div className="template-form-section">
              <h3>문서 내용과 작성 가이드</h3>
              <p className="muted">
                본문과 예시는 Markdown으로 작성할 수 있습니다.
              </p>
              {(
                [
                  ["body", "템플릿 본문"],
                  ["example", "작성 예시"],
                  ["prompt", "AI 작성 지침"],
                ] as const
              ).map(([key, label]) => (
                <MarkdownEditor
                  key={key}
                  label={label}
                  value={draft[key]}
                  onChange={(value) => setDraft({ ...draft, [key]: value })}
                />
              ))}
              <label>
                기본 체크리스트 (한 줄에 하나)
                <Textarea
                  value={checks}
                  onChange={(e) => setChecks(e.target.value)}
                />
              </label>
            </div>
            <DocumentExtensions
              extensions={draft.extensions ?? []}
              disabled={busy}
              onChange={(extensions) => setDraft({ ...draft, extensions })}
            />
            <div className="template-editor-footer">
              <Button type="submit" disabled={busy}>
                <Save size={16} />
                템플릿 저장
              </Button>
              <span className="save-feedback" role="status">
                {busy ? "저장 중…" : saved ? "템플릿을 저장했습니다." : ""}
              </span>
            </div>
          </form>
          {revision && (
            <section className="template-danger-zone" aria-label="Danger zone">
              <div>
                <h3>Danger zone</h3>
                <p>
                  템플릿을 삭제하면 복구할 수 없습니다. 이 템플릿으로 만든 기존
                  문서는 유지됩니다.
                </p>
              </div>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={15} />
                템플릿 삭제
              </Button>
            </section>
          )}
        </div>
      </div>
      <Dialog
        open={pendingTemplate !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>저장하지 않은 템플릿 변경</DialogTitle>
            <DialogDescription>
              다른 템플릿으로 이동하면 저장하지 않은 내용은 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingTemplate(undefined)}
            >
              계속 편집
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectTemplate(pendingTemplate ?? null)}
            >
              변경 버리고 이동
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿을 삭제할까요?</DialogTitle>
            <DialogDescription>
              이 템플릿으로 만든 기존 문서는 유지됩니다. 삭제한 템플릿은 복구할
              수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void removeTemplate()}
            >
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
