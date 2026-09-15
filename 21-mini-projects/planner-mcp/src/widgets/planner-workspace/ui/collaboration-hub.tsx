"use client";
import { useRef, useState } from "react";
import type { Project } from "@/entities/document/model/schema";
import type { CollaborationProject } from "@/entities/document/model/collaboration";
import { createRequestId } from "@/shared/lib/request-id";

export function CollaborationHub({
  project,
  data,
  inbox,
  navigate,
  changeTab,
  mutate,
}: {
  project: Project;
  data?: CollaborationProject;
  inbox: boolean;
  navigate: (id: string) => void;
  changeTab: (tab: string) => void;
  mutate: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [answerStatus, setAnswerStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ payload: string; requestId: string } | null>(null);
  const docs = data?.documents ?? [];
  const questions = docs.flatMap((doc) =>
    doc.openQuestions.filter((q) => !q.resolved).map((q) => ({ doc, q })),
  );
  const draft = docs.filter((d) => d.status === "draft");
  const reviewed = docs.filter((d) => d.status === "reviewed");
  const changed = docs.filter((d) => d.needsReview);
  const instruction = `Planner MCP 프로젝트 ${project.id} (${project.name})의 설계 작업을 진행하세요.\nget_project로 원본 sources를 읽고 get_catalog, get_document_index, get_document로 기존 설계와 검토 의견을 확인하세요.\n미해결 질문의 questionId가 연결된 comments를 읽고 답변을 본문에 반영한 뒤 해당 openQuestions의 answer/resolved를 갱신하세요. 불확실한 내용은 질문으로 남기세요.\nvalidate_document 후 save_document를 사용하세요. 갱신에는 최신 expectedRevision, 재시도에는 동일 requestId와 내용을 유지하세요.\n필요한 문서만 작성하며 사용자 승인을 대신 수행하지 마세요. 변경 사항과 남은 질문을 요약하세요.`;
  if (!data) return <p role="status">협업 요약을 불러오는 중입니다.</p>;
  return (
    <section
      className="panel collaboration-hub"
      aria-label={inbox ? "검토함" : "프로젝트 홈"}
    >
      <h2>{inbox ? "검토함" : "지금 처리할 일"}</h2>
      {!!data.problems.length && (
        <div role="alert">
          일부 요약을 읽지 못했습니다. 아래 수치는 불완전할 수 있습니다.
          {data.problems.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <div className="toolbar">
        <button onClick={() => changeTab("inbox")}>
          미해결 질문 {questions.length}개
        </button>
        <button onClick={() => changeTab("inbox")}>
          검토할 초안 {draft.length}개
        </button>
        <button onClick={() => changeTab("inbox")}>
          승인 대기 {reviewed.length}개
        </button>
        <button onClick={() => changeTab("inbox")}>
          기준 변경 {changed.length}개
        </button>
        <button onClick={() => changeTab("handoff")}>
          승인 문서 {docs.filter((d) => d.status === "approved").length}개 ·
          인계
        </button>
      </div>
      {!inbox && (
        <>
          <h3>다음 행동</h3>
          <p>
            입력 자료 → 설계 AI 요청 → 질문·검토 → 사용자 승인 → 고정 버전 인계
          </p>
          <button onClick={() => changeTab("sources")}>
            입력 자료 확인 ({project.sources.length})
          </button>
          <button onClick={() => changeTab("documents")}>설계 문서 보기</button>
          {!docs.length && (
            <p>
              아직 문서가 없습니다. 입력 자료를 추가하고 아래 지시를 연결된 AI에
              전달하세요.
            </p>
          )}
          <details>
            <summary>설계 AI 작업 지시</summary>
            <p>
              복사는 전송이나 실행이 아닙니다. 연결된 Codex 대화에 붙여 넣어
              실행하세요.
            </p>
            <textarea
              aria-label="설계 AI 작업 지시"
              readOnly
              value={instruction}
              rows={8}
            />
            <button
              onClick={async () => {
                try {
                  if (!navigator.clipboard) throw new Error();
                  await navigator.clipboard.writeText(instruction);
                  setCopyStatus(
                    "복사했습니다. 연결된 AI에 직접 붙여 넣으세요.",
                  );
                } catch {
                  setCopyStatus(
                    "자동 복사가 불가능합니다. 위 텍스트를 선택해 수동 복사하세요.",
                  );
                }
              }}
            >
              작업 지시 복사
            </button>
            <p role="status">{copyStatus}</p>
          </details>
          <h3>최근 변경된 문서</h3>
          <p className="muted">
            현재 문서 수정 시각 기준이며 전체 활동 이력은 아닙니다.
          </p>
          <ul>
            {docs.slice(0, 5).map((d) => (
              <li key={d.id}>
                <button onClick={() => navigate(d.id)}>
                  {d.title} · r{d.revision}
                </button>{" "}
                <time dateTime={d.updatedAt}>
                  {new Date(d.updatedAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
      {inbox && (
        <>
          <h3>질문과 답변</h3>
          <p>
            답변은 검토 의견으로 보존됩니다. AI가 설계에 반영하기 전까지 질문은
            미해결이며 차단 질문은 승인을 막습니다.
          </p>
          {!questions.length && <p>미해결 질문이 없습니다.</p>}
          {questions.map(({ doc, q }) => {
            const replies = doc.comments.filter((c) => c.questionId === q.id);
            return (
              <article className="question-card" key={`${doc.id}/${q.id}`}>
                <h4>{q.text}</h4>
                <p>
                  {q.blocking ? "승인 차단" : "확인 필요"} ·{" "}
                  {replies.length
                    ? "답변 기록됨 · 설계 반영 대기"
                    : "답변 필요"}
                </p>
                <button onClick={() => navigate(doc.id)}>
                  {doc.title} 검토
                </button>
                {replies.map((r) => (
                  <blockquote key={r.id}>
                    {r.text} — {r.author}
                  </blockquote>
                ))}
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const text = String(
                      new FormData(form).get("answer") ?? "",
                    ).trim();
                    if (!text || busy) return;
                    const input = {
                      action: "comment",
                      projectId: project.id,
                      documentId: doc.id,
                      expectedRevision: doc.revision,
                      questionId: q.id,
                      text,
                      author: "로컬 사용자",
                    };
                    const payload = JSON.stringify(input);
                    if (pending.current?.payload !== payload)
                      pending.current = {
                        payload,
                        requestId: createRequestId(),
                      };
                    setBusy(true);
                    setAnswerStatus("");
                    try {
                      const result = await mutate({
                        ...input,
                        requestId: pending.current.requestId,
                      });
                      if (result) {
                        form.reset();
                        pending.current = null;
                        setAnswerStatus(
                          "답변을 기록했습니다. 설계 AI의 반영이 필요합니다.",
                        );
                      }
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    답변
                    <textarea name="answer" required maxLength={5000} />
                  </label>
                  <button disabled={busy}>답변 기록</button>
                </form>
              </article>
            );
          })}
          <p role="status">{answerStatus}</p>
          {[
            ["검토할 초안", draft],
            ["사용자 승인 대기", reviewed],
            ["기준 변경 · 재검토", changed],
          ].map(([label, entries]) => (
            <section key={String(label)}>
              <h3>{String(label)}</h3>
              <ul>
                {(entries as typeof docs).map((d) => (
                  <li key={d.id}>
                    <button onClick={() => navigate(d.id)}>
                      {d.title} · r{d.revision} 검토
                    </button>
                  </li>
                ))}
              </ul>
              {!(entries as typeof docs).length && <p>대상 문서가 없습니다.</p>}
            </section>
          ))}
        </>
      )}
      <p className="muted">
        승인된 설계는 개발 기준이지 구현 완료가 아닙니다. 사용자 이름은 인증된
        신원이 아닙니다.
      </p>
    </section>
  );
}
