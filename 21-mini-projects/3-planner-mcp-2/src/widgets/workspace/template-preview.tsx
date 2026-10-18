"use client";
import type { DocumentExtension } from "@/entities/planner/extensions";
import { DocumentExtensions } from "./document-extensions";
import { Eye } from "lucide-react";
import { MarkdownView } from "../../entities/planner/document-view";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

export function TemplatePreview({
  title,
  body,
  example,
  extensions = [],
}: {
  title: string;
  body: string;
  example: string;
  extensions?: DocumentExtension[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="preview-button">
          <Eye size={16} />
          템플릿 미리보기
        </Button>
      </DialogTrigger>
      <DialogContent
        className="template-preview-dialog"
        closeLabel="미리보기 닫기"
      >
        <DialogHeader>
          <DialogTitle>템플릿 미리보기</DialogTitle>
          <DialogDescription>
            {title || "새 템플릿"} · 저장 전 내용도 확인할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <section>
          <h3>템플릿 본문</h3>
          {body ? (
            <MarkdownView body={body} />
          ) : (
            <p className="muted">작성한 본문이 없습니다.</p>
          )}
        </section>
        <section>
          <h3>작성 예시</h3>
          {example ? (
            <MarkdownView body={example} />
          ) : (
            <p className="muted">작성한 예시가 없습니다.</p>
          )}
        </section>
        {extensions.length > 0 && (
          <DocumentExtensions extensions={extensions} />
        )}
      </DialogContent>
    </Dialog>
  );
}
