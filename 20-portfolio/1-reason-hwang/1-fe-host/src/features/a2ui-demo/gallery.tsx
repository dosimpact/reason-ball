"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { definitions, type ComponentName } from "@/lib/a2ui/definitions";
import { FixturePreview } from "@/lib/a2ui/fixture-preview";
import { fixtureOperations, fixtures } from "@/lib/a2ui/fixtures";
import { Button } from "@/components/ui/button";

const modelSchema = z.object({
  title: z.string(), description: z.string(), revenue: z.string(), accounts: z.string(),
  value: z.string(), text: z.string(), checked: z.boolean(), date: z.string(),
  page: z.number().int().min(1).max(3), progress: z.number().min(0).max(100),
  series: z.array(z.object({ label: z.string(), value: z.number().finite() })).max(100),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean()]))).max(200),
}).passthrough();

function initialModel(name: ComponentName) {
  return modelSchema.parse(fixtureOperations(name)[2].updateDataModel?.value);
}

export function A2UIGallery() {
  const [name, setName] = useState<ComponentName>("Card");
  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <header className="space-y-3">
      <Link href="/a2ui" className="text-sm underline">A2UI 데모</Link>
      <h1 className="text-3xl font-semibold">컴포넌트 카탈로그</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">61개 UI 파일의 조합형 어댑터와 5개 레이아웃·표시 항목을 직접 체험하세요. 데이터 모델의 값을 수정하고 적용하면 실제 A2UI 미리보기가 바뀝니다.</p>
    </header>
    <label className="flex flex-wrap items-center gap-3 text-sm font-medium">컴포넌트
      <select value={name} onChange={event => setName(event.target.value as ComponentName)} className="min-w-56 rounded-md border bg-background p-2">
        {Object.keys(definitions).sort().map(key => <option key={key}>{key}</option>)}
      </select>
      <span className="text-xs text-muted-foreground">{Object.keys(definitions).length}개 등록</span>
    </label>
    <GalleryEditor key={name} name={name} />
  </main>;
}

function GalleryEditor({ name }: { name: ComponentName }) {
  const [model, setModel] = useState(() => initialModel(name));
  const [draft, setDraft] = useState(() => JSON.stringify(model, null, 2));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  function apply() {
    try {
      const result = modelSchema.safeParse(JSON.parse(draft));
      if (!result.success) {
        setError(result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(" / "));
        setStatus("");
        return;
      }
      setModel(result.data);
      setRevision(value => value + 1);
      setError("");
      setStatus("데이터 모델을 미리보기에 적용했습니다.");
    } catch {
      setError("JSON 형식을 확인하세요. 문자열은 큰따옴표로 감싸야 합니다.");
      setStatus("");
    }
  }
  function reset() {
    const next = initialModel(name);
    setModel(next);
    setDraft(JSON.stringify(next, null, 2));
    setRevision(value => value + 1);
    setError("");
    setStatus("예제 데이터를 초기화했습니다.");
  }
  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <section aria-label="컴포넌트 미리보기" className="min-w-0 overflow-hidden rounded-xl border bg-muted/20">
      <div className="border-b bg-background px-4 py-3"><h2 className="font-semibold">{name} 미리보기</h2><p className="mt-1 text-xs text-muted-foreground">가상 데이터 · 입력 컴포넌트는 조작 후 바인딩 확인으로 action을 확인하세요.</p></div>
      <FixturePreview key={revision} name={name} dataModel={model} />
    </section>
    <section aria-label="데이터 모델 편집" className="min-w-0 space-y-4 rounded-xl border p-4">
      <div><h2 className="font-semibold">데이터 모델</h2><p id="model-help" className="mt-2 text-sm text-muted-foreground">아래 JSON을 수정하세요. Card는 title, revenue, accounts, series, rows를 사용합니다. 각 값은 독립적이며 합계는 자동 계산하지 않습니다.</p></div>
      <label className="block space-y-2 text-sm"><span>데이터 모델 JSON</span><textarea aria-describedby="model-help" spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} className="min-h-96 w-full rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5" /></label>
      <div className="flex flex-wrap gap-2"><Button onClick={apply}>미리보기에 적용</Button><Button variant="outline" onClick={reset}>예제 초기화</Button></div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <p role="status" className="text-sm text-muted-foreground">{status}</p>
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">컴포넌트 속성과 바인딩 보기</summary><p className="my-3 text-xs text-muted-foreground">path는 데이터 모델의 경로입니다. 이 패널은 읽기 전용이며 하위 컴포넌트 구성도 포함합니다.</p><pre className="max-h-80 overflow-auto text-xs">{JSON.stringify(fixtureOperations(name)[1].updateComponents, null, 2)}</pre></details>
      <p className="text-xs text-muted-foreground">{Object.values(fixtures[name]).some(value => value && typeof value === "object" && "path" in value) ? "이 예제는 데이터 모델에 바인딩된 속성을 포함합니다." : "이 컴포넌트의 고정 속성은 JSON 데이터 변경으로 바뀌지 않습니다. 바인딩된 하위 컴포넌트와 입력값을 확인하세요."} 적용 및 초기화 시 미리보기의 입력 상태와 최근 action을 초기화합니다.</p>
    </section>
  </div>;
}
