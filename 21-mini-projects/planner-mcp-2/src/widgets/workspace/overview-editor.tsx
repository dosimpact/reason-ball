"use client";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import type { Document } from "@/entities/planner/model";
type Entry = Document["overview"][number];
export function OverviewEditor({
  entries,
  documents,
  onChange,
}: {
  entries: Entry[];
  documents: Document[];
  onChange: (entries: Entry[]) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  function update(id: string, patch: Partial<Entry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function descendantIds(id: string) {
    const found = new Set([id]);
    let previous = 0;
    while (previous !== found.size) {
      previous = found.size;
      for (const e of entries)
        if (e.parentId && found.has(e.parentId)) found.add(e.id);
    }
    return found;
  }
  return (
    <section>
      <h3>비즈니스 흐름 편집</h3>
      {entries.map((e, index) => (
        <details key={e.id} open>
          <summary>{e.title || `새 항목 ${index + 1}`}</summary>
          <label>
            항목 이름
            <Input
              value={e.title}
              onChange={(event) => update(e.id, { title: event.target.value })}
            />
          </label>
          <label>
            상위 항목
            <select
              value={e.parentId ?? ""}
              onChange={(event) =>
                update(e.id, { parentId: event.target.value || null })
              }
            >
              <option value="">최상위</option>
              {entries
                .filter((other) => !descendantIds(e.id).has(other.id))
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            What — 비즈니스 내용
            <Textarea
              value={e.what}
              onChange={(event) => update(e.id, { what: event.target.value })}
            />
          </label>
          <label>
            How to — 구현 방법
            <Textarea
              value={e.how}
              onChange={(event) => update(e.id, { how: event.target.value })}
            />
          </label>
          <label>
            검증 문서 연결
            <select
              value={e.verificationDocumentId ?? ""}
              onChange={(event) =>
                update(e.id, {
                  verificationDocumentId: event.target.value || null,
                })
              }
            >
              <option value="">연결 없음</option>
              {documents
                .filter(
                  (d) =>
                    d.kind === "design-verification" ||
                    d.kind === "verification-result",
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </label>
          <Button variant="destructive" onClick={() => setDeletingId(e.id)}>
            흐름 항목 삭제
          </Button>
        </details>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          onChange([
            ...entries,
            {
              id: crypto.randomUUID(),
              parentId: null,
              title: "새 항목",
              what: "",
              how: "",
              verificationDocumentId: null,
            },
          ])
        }
      >
        흐름 항목 추가
      </Button>
      <Dialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>흐름 항목을 삭제할까요?</DialogTitle>
            <DialogDescription>
              이 항목과 하위 흐름 항목을 함께 삭제합니다. 변경 사항은 문서를
              저장하면 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deletingId) return;
                const removed = descendantIds(deletingId);
                onChange(entries.filter((entry) => !removed.has(entry.id)));
                setDeletingId(null);
              }}
            >
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
