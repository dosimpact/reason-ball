"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TemplateViewer } from "@/entities/template/ui/template-viewer";
import {
  templateDraftSchema,
  type DocumentTemplate,
  type TemplateDraft,
} from "@/entities/template/model/schema";
import { createRequestId } from "@/shared/lib/request-id";

const blank = (): TemplateDraft => ({
  name: "",
  title: "",
  description: "",
  format: "markdown",
  body: "",
  example: "",
  prompt: "",
});
type Pending = { url: string; method: string; body: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(init ? 30_000 : 15_000),
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(value.error?.message ?? "요청에 실패했습니다."),
      { confirmed: response.status < 500 },
    );
  return value.result;
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(blank);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("template");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [live, setLive] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const list = await api<DocumentTemplate[]>("/api/templates");
      if (current !== generation.current) return;
      setTemplates(list);
      setLoaded(true);
      setListError("");
    } catch (e) {
      if (current === generation.current) setListError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const requests = generation;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    const events = new EventSource("/api/events");
    const ready = () => {
      setLive(true);
      void refresh();
    };
    events.addEventListener("ready", ready);
    events.addEventListener("templates", refresh);
    events.onerror = () => setLive(false);
    return () => {
      events.close();
      active = false;
      requests.current++;
    };
  }, [refresh]);
  const latest = templates.find((t) => t.name === selected?.name);
  const stale =
    !!selected && loaded && (!latest || latest.revision !== selected.revision);
  function choose(template: DocumentTemplate | null) {
    if (pending || busy) return;
    if (dirty && !window.confirm("저장하지 않은 변경을 버리고 이동할까요?"))
      return;
    setSelected(template);
    setDraft(
      template
        ? {
            name: template.name,
            title: template.title,
            description: template.description,
            format: template.format,
            body: template.body,
            example: template.example,
            prompt: template.prompt,
          }
        : blank(),
    );
    setDirty(false);
    setConfirmDelete(false);
    setError("");
    setStatus("");
  }
  function change(field: keyof TemplateDraft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setDirty(true);
    setStatus("");
  }
  async function execute(request: Pending) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await api<DocumentTemplate>(request.url, {
        method: request.method,
        body: request.body,
      });
      setPending(null);
      setDirty(false);
      setConfirmDelete(false);
      if (request.method === "DELETE") {
        setSelected(null);
        setDraft(blank());
        setStatus("템플릿을 삭제했습니다.");
      } else {
        setSelected(result);
        setDraft({
          name: result.name,
          title: result.title,
          description: result.description,
          format: result.format,
          body: result.body,
          example: result.example,
          prompt: result.prompt,
        });
        setStatus("템플릿과 프롬프트를 저장했습니다.");
      }
      await refresh();
    } catch (e) {
      if ((e as Error & { confirmed?: boolean }).confirmed) {
        setPending(null);
        setError((e as Error).message);
      } else {
        setPending(request);
        setError(
          "저장 결과를 확인하지 못했습니다. 같은 요청으로 재시도하세요.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  function save() {
    const parsed = templateDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" / "),
      );
      return;
    }
    void execute({
      url: selected ? `/api/templates/${selected.name}` : "/api/templates",
      method: selected ? "PUT" : "POST",
      body: JSON.stringify({
        requestId: createRequestId(),
        template: parsed.data,
        ...(selected ? { expectedRevision: selected.revision } : {}),
      }),
    });
  }
  return (
    <main className="template-page">
      <header className="template-header">
        <div>
          <Link href="/">← 프로젝트 작업 공간</Link>
          <h1>문서 템플릿</h1>
          <p>템플릿·예시·AI 사용 프롬프트를 함께 관리합니다.</p>
        </div>
        <span className="badge">
          {live ? "실시간 연결됨" : "실시간 연결 대기"}
        </span>
      </header>
      <div className="template-layout">
        <aside className="panel template-list" aria-label="템플릿 목록">
          <div className="toolbar">
            <h2>공용 템플릿</h2>
            <button disabled={busy || !!pending} onClick={() => choose(null)}>
              새 템플릿
            </button>
            <button onClick={() => void refresh()}>목록 새로고침</button>
          </div>
          {listError ? (
            <p role="alert">{listError}</p>
          ) : !loaded ? (
            <p role="status">템플릿을 불러오는 중…</p>
          ) : !templates.length ? (
            <p>아직 템플릿이 없습니다. 첫 템플릿을 만들어 보세요.</p>
          ) : (
            <ul>
              {templates.map((t) => (
                <li key={t.name}>
                  <button
                    aria-pressed={selected?.name === t.name}
                    disabled={busy || !!pending}
                    onClick={() => choose(t)}
                  >
                    <strong>{t.title}</strong>
                    <small>
                      {t.name} · r{t.revision}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="panel template-editor" aria-label="템플릿 관리">
          <h2>{selected ? `${selected.title} 편집` : "새 템플릿 만들기"}</h2>
          {stale && (
            <div role="alert">
              저장된 템플릿이 변경되거나 삭제되었습니다. 입력은 유지됩니다.{" "}
              <button
                disabled={busy || !!pending}
                onClick={() => choose(latest ?? null)}
              >
                최신 내용 불러오기
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          {status && <p role="status">{status}</p>}
          {pending && (
            <button disabled={busy} onClick={() => void execute(pending)}>
              같은 요청으로 재시도
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <fieldset disabled={busy || !!pending}>
              <div className="template-fields">
                <label>
                  템플릿 이름
                  <input
                    required
                    value={draft.name}
                    disabled={!!selected}
                    maxLength={80}
                    placeholder="api-design"
                    onChange={(e) => change("name", e.target.value)}
                  />
                </label>
                <label>
                  표시 제목
                  <input
                    required
                    value={draft.title}
                    maxLength={200}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </label>
              </div>
              <p className="muted">
                이름은 소문자 영문·숫자·하이픈을 사용하며 생성 후 유지됩니다.
              </p>
              <label>
                설명
                <textarea
                  value={draft.description}
                  maxLength={5000}
                  rows={2}
                  onChange={(e) => change("description", e.target.value)}
                />
              </label>
              <label>
                표시 형식
                <select
                  value={draft.format}
                  onChange={(e) => change("format", e.target.value)}
                >
                  <option value="markdown">Markdown + Mermaid</option>
                </select>
              </label>
              <label>
                템플릿 본문
                <textarea
                  required
                  value={draft.body}
                  rows={9}
                  maxLength={200000}
                  placeholder="# {{제목}}"
                  onChange={(e) => change("body", e.target.value)}
                />
              </label>
              <label>
                예시 본문
                <textarea
                  required
                  value={draft.example}
                  rows={7}
                  maxLength={200000}
                  onChange={(e) => change("example", e.target.value)}
                />
              </label>
              <label>
                AI 사용 프롬프트
                <textarea
                  required
                  value={draft.prompt}
                  rows={6}
                  maxLength={50000}
                  placeholder="AI가 이 템플릿을 언제, 어떤 입력으로, 어떻게 작성해야 하는지 설명하세요."
                  onChange={(e) => change("prompt", e.target.value)}
                />
              </label>
              <div className="toolbar">
                <button className="primary" type="submit">
                  {busy ? "저장 중…" : "템플릿 저장"}
                </button>
                {dirty && <span>저장하지 않은 변경</span>}
                {selected && (
                  <button type="button" onClick={() => setConfirmDelete(true)}>
                    템플릿 삭제
                  </button>
                )}
              </div>
              {confirmDelete && selected && (
                <div role="group" aria-label="삭제 확인">
                  <p>{selected.name} 템플릿을 삭제할까요?</p>
                  <button
                    type="button"
                    onClick={() =>
                      void execute({
                        url: `/api/templates/${selected.name}`,
                        method: "DELETE",
                        body: JSON.stringify({
                          requestId: createRequestId(),
                          expectedRevision: selected.revision,
                        }),
                      })
                    }
                  >
                    삭제 확정
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}>
                    취소
                  </button>
                </div>
              )}
            </fieldset>
          </form>
          <div className="tabs" role="tablist" aria-label="미리보기 선택">
            {[
              ["template", "템플릿 보기"],
              ["example", "예시 보기"],
              ["prompt", "프롬프트 보기"],
            ].map(([key, label]) => (
              <button
                role="tab"
                aria-selected={tab === key}
                key={key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <section
            className="template-preview"
            aria-label="미리보기"
            role="tabpanel"
          >
            {tab === "prompt" ? (
              <pre>{draft.prompt || "AI 사용 프롬프트를 입력하세요."}</pre>
            ) : (
              <TemplateViewer
                format={draft.format}
                source={tab === "template" ? draft.body : draft.example}
              />
            )}
            {tab !== "prompt" && (
              <details>
                <summary>Markdown 원문</summary>
                <pre>{tab === "template" ? draft.body : draft.example}</pre>
              </details>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
