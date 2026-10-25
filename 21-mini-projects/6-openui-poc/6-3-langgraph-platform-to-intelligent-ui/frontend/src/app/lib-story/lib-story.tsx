"use client";
import "@/lib/devtools";
import { createLibrary, Renderer, type ActionEvent, type OpenUIError } from "@openuidev/react-lang";
import { useCallback, useEffect, useState } from "react";
import { runLibraryAction } from "@/lib/actions";
import { withBase } from "@/lib/base-path";
import { webUrl } from "@/lib/components/style";
import { Col } from "@/lib/components/layout";
import { library } from "@/lib/library";
import stories from "./stories.json";
import "./lib-story.css";

type Story = (typeof stories)[number];
const colOnlyLibrary = createLibrary({ root: "Col", components: [Col] });
const categories = ["components", "functions", "actions"];
function StoryExample({ example, name, isolated, onAction }: {
  example: Story["examples"][number]; name: string; isolated: boolean; onAction: (event: ActionEvent) => void;
}) {
  const [draft, setDraft] = useState(example.code);
  const [code, setCode] = useState(example.code);
  const [revision, setRevision] = useState(0);
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  const onError = useCallback((next: OpenUIError[]) => setErrors(next), []);
  return <section className="story-example">
    <header><h3>{example.title}</h3><span>OpenUI Lang → React</span></header>
    <div className="story-example-grid">
      <div className="story-code"><label>{name} · OpenUI Lang
        <textarea aria-label={`${name} ${example.title} 코드`} spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} />
      </label><div className="story-code-actions">
        <button type="button" onClick={() => { setCode(draft); setErrors([]); setRevision(value => value + 1); }}>코드 적용</button>
        <button type="button" onClick={() => { setDraft(example.code); setCode(example.code); setErrors([]); setRevision(value => value + 1); }}>초기화</button>
      </div></div>
      <div className="story-render"><span className="story-render-label">렌더링 결과</span>
        <Renderer key={revision} response={code} library={isolated ? colOnlyLibrary : library} isStreaming={false} onAction={onAction} onError={onError} />
        {errors.length > 0 && <ul className="story-errors" role="alert">{errors.map((error, index) => <li key={index}>{error.message}</li>)}</ul>}
      </div>
    </div>
  </section>;
}
export function LibStory({ theme }: { theme: "light" | "dark" }) {
  const [selectedId, setSelectedId] = useState(stories[0].id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("components");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const sync = () => {
      const story = stories.find(item => `#${item.id}` === window.location.hash || `#${item.name.toLowerCase()}` === window.location.hash);
      if (story) { setSelectedId(story.id); setCategory(story.category); }
    };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const selected = stories.find(story => story.id === selectedId) ?? stories[0];
  const filtered = stories.filter(story => story.category === category && `${story.name} ${story.description}`.toLowerCase().includes(query.toLowerCase()));
  const onAction = useCallback((event: ActionEvent) => {
    const custom = runLibraryAction(event);
    if (custom) { void custom.then(ok => setNotice(ok ? "클립보드에 복사했습니다." : "복사하지 못했습니다. 권한과 포커스를 확인하세요.")); return; }
    if (event.type === "open_url") {
      const url = webUrl(String(event.params?.url ?? ""));
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setNotice(`이벤트: ${event.type} · ${event.humanFriendlyMessage || ""} · 폼 ${JSON.stringify(event.formState ?? {})} (모델 호출 없음)`);
  }, []);
  return <div className="lib-story" data-theme={theme} data-openui-theme={theme}>
    <header className="story-top"><a href={withBase("/lib-story")}>OpenUI <strong>Lib Story</strong></a>
      <nav aria-label="페이지와 테마"><a href={withBase("/gallery")}>Gallery ↗</a><a href={`?theme=${theme === "light" ? "dark" : "light"}#${selected.id}`}>{theme === "light" ? "Dark" : "Light"}</a></nav>
    </header>
    <div className="story-layout"><aside className="story-sidebar">
      <p className="story-eyebrow">LIBRARY EXPLORER</p><h1>하나씩, 직접 실행하기</h1>
      <p className="story-summary">55개 컴포넌트 · 59개 함수 · 1개 액션<br />모델 호출 없이 코드와 결과를 비교합니다.</p>
      <label className="story-search">항목 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Col, Percent, Copy…" /></label>
      <div className="story-tabs" role="group" aria-label="라이브러리 종류">{categories.map(id => <button key={id} type="button" aria-pressed={category === id} onClick={() => { setCategory(id); setQuery(""); }}>{id} <small>{stories.filter(story => story.category === id).length}</small></button>)}</div>
      <nav className="story-index" aria-label="라이브러리 항목">{filtered.map(story => <a key={story.id} href={`#${story.id}`} aria-current={selected.id === story.id ? "page" : undefined}>◇ <span>{story.name}</span><small>{story.examples.length}</small></a>)}</nav>
      {filtered.length === 0 && <p>일치하는 항목이 없습니다.</p>}
    </aside><main className="story-main" id={selected.id}>
      <div className="story-heading"><span className="story-eyebrow">{selected.category} / {selected.name}</span><h2>{selected.name}</h2><p>{selected.description || "등록된 UI 컴포넌트의 개별 사용 예시입니다."}</p><code>{selected.signature}</code><p className="story-note">{selected.note}</p></div>
      <div key={selected.id}>{selected.examples.map((example, index) => <StoryExample key={index} example={example} name={selected.name} isolated={selected.name === "Col" && selected.category === "components"} onAction={onAction} />)}</div>
    </main></div>
    {notice && <div className="story-notice" role="status">{notice}<button type="button" aria-label="알림 닫기" onClick={() => setNotice("")}>×</button></div>}
  </div>;
}
