"use client";

import Link from "next/link";
import { Component, useCallback, useMemo, useState, type ReactNode } from "react";
import { Renderer } from "@openuidev/react-lang";
import { Button, Input } from "@grafana/ui";
import { sagaChatLibrary, sagaGalleryEntries } from "@/lib/saga-genui";
import { useSagaTheme } from "@/components/saga/theme";

class PreviewBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    return this.state.error ? <p role="alert" data-testid="gallery-render-error">Render error: {this.state.error}</p> : this.props.children;
  }
}

function Preview({ program }: { program: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const reportErrors = useCallback((issues: { message: string }[]) => {
    setErrors(previous => {
      const next = issues.map(issue => issue.message);
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, []);
  return <>
    <div data-testid="openui-preview">
      <PreviewBoundary><Renderer response={program} library={sagaChatLibrary} onError={reportErrors} onAction={event => setAction(JSON.stringify(event))} /></PreviewBoundary>
    </div>
    {errors.length > 0 && <p role="alert" data-testid="gallery-render-error">{errors.join("; ")}</p>}
    {action && <output aria-label="Last gallery action">{action}</output>}
  </>;
}

export default function Gallery() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(() => new URLSearchParams(window.location.search).get("component") || sagaGalleryEntries.find(entry => entry.status === "supported")?.name || "");
  const { mode, toggleTheme } = useSagaTheme();
  const entries = useMemo(() => sagaGalleryEntries.filter(entry => `${entry.name} ${entry.category} ${entry.description}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const categories = [...new Set(entries.map(entry => entry.category))];
  const supported = sagaGalleryEntries.filter(entry => entry.status === "supported");
  return <main style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
    <header style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
      <Link href="/">← Saga chat</Link>
      <h1>Saga component gallery</h1>
      <Button type="button" variant="secondary" onClick={toggleTheme} aria-label="Toggle gallery theme">{mode === "dark" ? "Light theme" : "Dark theme"}</Button>
    </header>
    <p>Grafana Saga components rendered from saved OpenUI programs. No model calls or API credentials are needed.</p>
    <p>{supported.length} supported · {sagaGalleryEntries.length - supported.length} excluded. Exclusions describe components outside the serializable chat catalog.</p>
    <label htmlFor="gallery-search">Search components</label>
    <Input id="gallery-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, group, or description" style={{ display: "block", width: "100%", padding: 12, margin: "8px 0 24px", border: "1px solid currentColor", borderRadius: 4 }} />
    {entries.length === 0 && <p>No matching components.</p>}
    {categories.map(category => <section key={category} aria-label={category}>
      <h2>{category}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", gap: 16 }}>
        {entries.filter(entry => entry.category === category).map(entry => <article key={entry.name} data-testid={`gallery-${entry.name}`} data-status={entry.status} style={{ border: "1px solid #80808066", borderRadius: 8, padding: 20, minWidth: 0 }}>
          <h3>{entry.name}</h3><p><strong>{entry.status}</strong> · {entry.description}</p>
          {entry.status === "supported" && entry.program && <>
            <Button type="button" variant="secondary" aria-expanded={active === entry.name} onClick={() => setActive(entry.name)}>Preview {entry.name}</Button>
            {active === entry.name && <Preview key={entry.name} program={entry.program} />}
          </>}
          {entry.program && <details><summary>OpenUI source</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{entry.program}</pre></details>}
        </article>)}
      </div>
    </section>)}
  </main>;
}
