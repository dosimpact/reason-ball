"use client";

import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import Link from "next/link";
import { useCallback, useState } from "react";
import { baseCatalogFixtures, type CatalogFixture } from "@/lib/catalog-fixtures";
import { additionalFixtures } from "@/lib/shadcn-genui/expanded-shadcn";
import { magicFixtures } from "@/lib/shadcn-genui/magic";
import { shadcnChatLibrary } from "@/lib/shadcn-genui";

const catalogFixtures: CatalogFixture[] = [...baseCatalogFixtures, ...additionalFixtures, ...magicFixtures];

function FixturePreview({ fixture, selected, onSelect }: { fixture: CatalogFixture; selected: boolean; onSelect: () => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [state, setState] = useState<Record<string, unknown>>({});
  const reportErrors = useCallback((items: OpenUIError[]) => {
    const next = items.map(item => JSON.stringify(item));
    setErrors(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  }, []);
  return <article id={fixture.id} data-testid={`fixture-${fixture.id}`} data-components={fixture.components.join(",")} className="rounded-xl border p-5 space-y-4 min-w-0">
    <header><h2 className="font-semibold text-xl">{fixture.title}</h2><p className="text-sm text-muted-foreground">{fixture.library} · {fixture.category} · {fixture.components.join(", ")}</p></header>
    {fixture.officialSlug && <a className="block text-sm underline" href={fixture.library === "magicui" ? `https://magicui.design/docs/components/${fixture.officialSlug}` : `https://ui.shadcn.com/docs/components/${fixture.officialSlug}`} target="_blank" rel="noreferrer">Official component documentation</a>}
    <button type="button" aria-expanded={selected} onClick={onSelect} className="rounded border px-3 py-2 text-sm">Preview {fixture.title}</button>
    {selected && <div data-testid="preview" className="p-4 min-h-24 overflow-x-auto">
      <Renderer response={fixture.source} library={shadcnChatLibrary} isStreaming={false} onAction={event => setAction(JSON.stringify(event))} onStateUpdate={setState} onError={reportErrors} />
    </div>}
    {errors.length > 0 && <pre data-testid="catalog-errors" role="alert" className="text-sm text-destructive whitespace-pre-wrap">{errors.join("\n")}</pre>}
    {action && <output aria-label="Last local action" className="block text-xs break-all">{action}</output>}
    <details><summary className="cursor-pointer text-sm">OpenUI source</summary><pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">{fixture.source}</pre></details>
    <details><summary className="cursor-pointer text-sm">Form state</summary><pre data-testid="form-state" className="text-xs whitespace-pre-wrap">{JSON.stringify(state, null, 2)}</pre></details>
  </article>;
}

function CustomProgram() {
  const [draft, setDraft] = useState('root = Card([TextContent("Custom preview")])');
  const [program, setProgram] = useState("");
  const [version, setVersion] = useState(0);
  return <section className="space-y-3 rounded-xl border p-5" aria-label="Custom OpenUI program">
    <h2 className="text-xl font-semibold">Custom OpenUI program</h2>
    <label htmlFor="custom-source" className="block text-sm">OpenUI source to render</label>
    <textarea id="custom-source" className="block min-h-32 w-full rounded border p-3 font-mono text-sm" value={draft} onChange={event => setDraft(event.target.value)} />
    <button type="button" className="rounded border px-3 py-2" onClick={() => { setProgram(draft); setVersion(value => value + 1); }}>Render program</button>
    {program && <FixturePreview key={version} fixture={{id: "custom", title: "Custom program", library: "shadcn", category: "Custom", components: [], source: program}} selected onSelect={() => undefined} />}
  </section>;
}

export default function ComponentGallery() {
  const [selected, setSelected] = useState("content");
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState("all");
  const [category, setCategory] = useState("all");
  const fixtures = catalogFixtures.filter(fixture => (library === "all" || fixture.library === library) && (category === "all" || fixture.category === category) && `${fixture.title} ${fixture.components.join(" ")} ${fixture.category}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
    <header className="space-y-2"><Link href="/" className="text-sm underline">Back to chat</Link><h1 className="text-3xl font-bold">Component gallery</h1><p>Deterministic OpenUI examples rendered by the chat library. Actions stay local; no model calls.</p></header>
    <CustomProgram />
    <div className="flex flex-wrap gap-4">
      <label className="space-y-1">Search<input aria-label="Search components" className="block rounded border px-3 py-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="Component name" /></label>
      <label className="space-y-1">Library<select aria-label="Library" className="block rounded border px-3 py-2" value={library} onChange={event => setLibrary(event.target.value)}><option value="all">All libraries</option><option value="shadcn">shadcn/ui</option><option value="magicui">Magic UI</option></select></label>
      <label className="space-y-1">Category<select aria-label="Category" className="block rounded border px-3 py-2" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(catalogFixtures.map(fixture => fixture.category))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <p role="status">{fixtures.length} examples · {new Set(catalogFixtures.flatMap(fixture => fixture.components)).size} component definitions covered</p>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{fixtures.map(fixture => <FixturePreview key={fixture.id} fixture={fixture} selected={selected === fixture.id} onSelect={() => setSelected(fixture.id)} />)}</div>
    {fixtures.length === 0 && <p>No matching components.</p>}
  </main>;
}
