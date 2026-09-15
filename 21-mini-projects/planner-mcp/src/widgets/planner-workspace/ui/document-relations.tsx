"use client";
import { useState } from "react";
import type { PlannerDocument } from "@/entities/document/model/schema";
import type { Relations } from "@/entities/document/lib/references";
import type { Difference } from "@/entities/document/lib/compare";
import { plannerRequest } from "@/shared/api/client";

export function DocumentRelations({
  document: doc,
  relations,
  navigate,
  historical,
}: {
  document: PlannerDocument;
  relations: Relations;
  navigate: (id: string, revision?: number) => void;
  historical: boolean;
}) {
  const [comparison, setComparison] = useState<Difference[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function compare(documentId: string, revision: number) {
    setBusy(true);
    setError("");
    setComparison(null);
    try {
      const result = await plannerRequest<{ differences: Difference[] }>({
        action: "compare",
        projectId: doc.projectId,
        before: { documentId, revision },
        after: { documentId: doc.id, revision: doc.revision },
      });
      setComparison(result.differences);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="context" aria-label="문서 관계와 버전">
      <h3>문서 관계와 버전</h3>
      {historical && (
        <p>
          역사 버전 r{doc.revision} · 읽기 전용{" "}
          <button onClick={() => navigate(doc.id)}>현재 버전으로</button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(
            doc.id,
            Number(new FormData(e.currentTarget).get("revision")),
          );
        }}
      >
        <label>
          조회할 revision
          <input
            name="revision"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={doc.revision}
          />
        </label>
        <button>버전 조회</button>
      </form>
      {doc.revision > 1 && (
        <button
          disabled={busy}
          onClick={() => void compare(doc.id, doc.revision - 1)}
        >
          이전 버전과 비교
        </button>
      )}
      {relations.outgoing.map((ref, i) => (
        <article key={i}>
          <p>
            {ref.kind === "overview" ? "연결된 Overview" : "기준 API"}:{" "}
            {ref.title} · r{ref.revision ?? "미지정"}
            {ref.nodeId && ` · 노드 ${ref.nodeId}`}
          </p>
          {ref.needsReview && (
            <p role="status">
              재검토 필요 ·{" "}
              {ref.error ??
                `기준 문서의 현재 버전은 r${ref.currentRevision}입니다.`}
            </p>
          )}
          <button onClick={() => navigate(ref.documentId, ref.revision)}>
            참조 버전 열기
          </button>{" "}
          {ref.kind === "api-base" && ref.revision && (
            <button
              disabled={busy}
              onClick={() => void compare(ref.documentId, ref.revision!)}
            >
              기준 버전과 비교
            </button>
          )}
        </article>
      ))}
      {!!relations.incoming.length && <h4>이 문서를 참조하는 문서</h4>}
      {relations.incoming.map((ref) => (
        <button key={ref.documentId} onClick={() => navigate(ref.documentId)}>
          {ref.title} 열기
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
      {comparison && (
        <section aria-label="버전 비교 결과">
          <h4>버전 비교 결과</h4>
          {!comparison.length ? (
            <p>내용 차이 없음</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>경로</th>
                    <th>변경</th>
                    <th>이전</th>
                    <th>이후</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.path}>
                      <td>{row.path}</td>
                      <td>{row.kind}</td>
                      <td>
                        <pre>
                          {JSON.stringify(row.before, null, 2) ?? "없음"}
                        </pre>
                      </td>
                      <td>
                        <pre>
                          {JSON.stringify(row.after, null, 2) ?? "없음"}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
