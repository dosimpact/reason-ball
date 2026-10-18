"use client";
import { useState } from "react";
import { FilePlus2, Folder } from "lucide-react";
import type { Document, Template } from "@/entities/planner/model";
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
import { api } from "@/shared/api";
export function CreateDocumentDialog({
  parent,
  projectTitle,
  templates,
  onClose,
  onCreated,
}: {
  parent: Document;
  projectTitle: string;
  templates: Template[];
  onClose: () => void;
  onCreated: (document: Document) => void;
}) {
  const [title, setTitle] = useState("");
  const [templateName, setTemplateName] = useState(
    templates.some((t) => t.name === "view")
      ? "view"
      : (templates[0]?.name ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const template = templates.find((t) => t.name === templateName);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <FilePlus2 size={20} /> 하위 문서 만들기
          </DialogTitle>
          <DialogDescription>
            현재 문서 아래에 템플릿으로 새 문서를 만듭니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const d = await api<Document>("documents", "POST", {
                projectId: parent.projectId,
                parentId: parent.id,
                phase: parent.phase,
                title: title.trim(),
                templateName,
              });
              onCreated(d);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="creation-location">
            <Folder size={16} />
            <div>
              <span className="muted">생성 위치</span>
              <strong>
                {projectTitle} / {parent.title}
              </strong>
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
          <label>
            새 문서 제목
            <Input
              autoFocus
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 로그인 화면 설계"
            />
          </label>
          <label>
            사용할 템플릿
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            >
              {templates.map((t) => (
                <option value={t.name} key={t.name}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            {template
              ? `이 템플릿의 본문과 ${template.checklist.length}개 체크리스트가 새 문서에 복사됩니다.`
              : "먼저 템플릿 관리에서 템플릿을 만들어 주세요."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy || !title.trim() || !template}>
              {busy ? "만드는 중…" : "문서 만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
