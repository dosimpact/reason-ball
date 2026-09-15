"use client";
import { useState } from "react";
import { flowRows, type FlowTree, type FlowEdit } from "../parser";
import { createRequestId } from "@/shared/lib/request-id";

export function FlowSpecEditor({
  tree,
  revision,
  save,
}: {
  tree: FlowTree;
  revision: number;
  save: (
    edit: FlowEdit,
    revision: number,
    requestId: string,
  ) => Promise<boolean>;
}) {
  const [base, setBase] = useState<number | null>(null);
  const [action, setAction] = useState<FlowEdit["action"]>("rename");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<{
    payload: string;
    id: string;
  } | null>(null);
  const rows = flowRows(tree);
  if (base === null)
    return (
      <button
        onClick={() => {
          setBase(revision);
          setRequest(null);
        }}
      >
        Flow 노드 편집
      </button>
    );
  return (
    <section aria-label="Flow 노드 편집" className="spec-card">
      <h3>Flow 노드 편집</h3>
      <p>기준 r{base} · 저장하면 새 초안이 됩니다.</p>
      {base !== revision && (
        <p role="alert">
          편집 중 문서가 변경되었습니다. 입력을 확인하고 취소 후 다시 여세요.
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const nodeId = String(data.get("nodeId")),
            parentId = String(data.get("parentId")),
            label = String(data.get("label"));
          const index = Number(data.get("index"));
          // Reuse the same request and generated node ID after an uncertain network failure.
          const payload = JSON.stringify({
            action,
            nodeId,
            parentId,
            label,
            kind: data.get("kind"),
            index,
            base,
          });
          const requestId =
            request?.payload === payload ? request.id : createRequestId();
          setRequest({ payload, id: requestId });
          const edit: FlowEdit =
            action === "rename"
              ? { action, nodeId, label }
              : action === "remove"
                ? { action, nodeId }
                : action === "move"
                  ? { action, nodeId, parentId, index }
                  : {
                      action,
                      parentId,
                      index,
                      node: {
                        id: requestId,
                        kind: data.get("kind") as "step" | "note",
                        label,
                      },
                    };
          setBusy(true);
          try {
            if (await save(edit, base, requestId)) setBase(null);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          편집 동작
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as FlowEdit["action"])}
          >
            <option value="rename">이름 변경</option>
            <option value="insert">추가</option>
            <option value="move">이동</option>
            <option value="remove">삭제</option>
          </select>
        </label>
        {action !== "insert" && (
          <label>
            대상 노드
            <select name="nodeId" required>
              {rows
                .filter((r) => r.node.kind !== "layer")
                .map((r) => (
                  <option key={r.node.id} value={r.node.id}>
                    {r.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        {(action === "insert" || action === "move") && (
          <>
            <label>
              부모 노드
              <select name="parentId" required>
                {rows
                  .filter((r) => r.node.kind !== "note")
                  .map((r) => (
                    <option key={r.node.id} value={r.node.id}>
                      {r.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              삽입 위치 (0부터, 이동 시 제거 후 기준)
              <input
                name="index"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            </label>
          </>
        )}
        {action === "insert" && (
          <label>
            노드 종류
            <select name="kind">
              <option value="step">단계</option>
              <option value="note">메모</option>
            </select>
          </label>
        )}
        {(action === "rename" || action === "insert") && (
          <label>
            노드 설명
            <input name="label" required maxLength={2000} />
          </label>
        )}
        {action === "remove" && (
          <p>
            선택한 노드와 하위 노드를 삭제합니다. 기존 버전은 이력에 남습니다.
          </p>
        )}
        <div className="toolbar">
          <button disabled={busy} type="submit">
            노드 변경 저장
          </button>
          <button disabled={busy} type="button" onClick={() => setBase(null)}>
            편집 취소
          </button>
        </div>
      </form>
    </section>
  );
}
