"use client";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDot,
  KeyRound,
  LockKeyhole,
  LogOut,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Actor = "Browser" | "Next.js BFF" | "Keycloak" | "Resource Server";

interface ProtocolTrace {
  traceId: string;
  stepId: string;
  timestamp: string;
  source: Actor;
  destination: Actor;
  method: string;
  url: string;
  request: { headers?: Record<string, string>; body?: unknown };
  response: { status: number; statusText?: string; headers?: Record<string, string>; body?: unknown };
  duration: number;
  explanation: string;
  observation: "observed" | "reconstructed" | "local-validation";
}

interface SessionView {
  authenticated: boolean;
  user: { subject: string; username: string; email?: string; name?: string } | null;
  token: {
    expiresAt: number;
    expiresInSeconds: number;
    scope: string;
    accessClaims: Record<string, unknown>;
    idClaims: Record<string, unknown>;
  } | null;
  traceCount: number;
}

const chapters = [
  { chapter: 1, title: "인증과 인가", phase: "Phase 2", status: "planned" },
  { chapter: 2, title: "OAuth 2.0 기본 구조", phase: "Phase 2", status: "planned" },
  { chapter: 3, title: "Authorization Code", phase: "MVP", status: "ready" },
  { chapter: 4, title: "PKCE", phase: "MVP", status: "ready" },
  { chapter: 5, title: "OpenID Connect", phase: "MVP", status: "ready" },
  { chapter: 6, title: "Token Lifecycle", phase: "Partial", status: "partial" },
  { chapter: 7, title: "API Authorization", phase: "MVP", status: "ready" },
  { chapter: 8, title: "SSO와 기업 인증", phase: "Phase 3", status: "planned" },
  { chapter: 9, title: "보안 실습", phase: "Partial", status: "partial" },
] as const;

const actors: Array<{ name: Actor; subtitle: string; icon: typeof UserRound }> = [
  { name: "Browser", subtitle: "User Agent", icon: UserRound },
  { name: "Next.js BFF", subtitle: "Confidential Client", icon: Server },
  { name: "Keycloak", subtitle: "Authorization Server", icon: KeyRound },
  { name: "Resource Server", subtitle: "Protected API", icon: ShieldCheck },
];

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="inspector-code">
      <code>{JSON.stringify(value ?? null, null, 2)}</code>
    </pre>
  );
}

function statusVariant(status: number) {
  if (status >= 200 && status < 400) return "success" as const;
  if (status >= 400) return "danger" as const;
  return "muted" as const;
}

function ArchitectureDiagram({ selected }: { selected: ProtocolTrace | undefined }) {
  return (
    <div className="architecture-map" aria-label="OAuth architecture actors">
      {actors.map((actor, index) => {
        const Icon = actor.icon;
        const involved = selected && (selected.source === actor.name || selected.destination === actor.name);
        const outgoing = selected?.source === actor.name;
        return (
          <div className="contents" key={actor.name}>
            <div className={cn("actor-node", involved && "actor-node-active")}>
              <div className="actor-icon"><Icon size={18} /></div>
              <div>
                <strong>{actor.name}</strong>
                <span>{actor.subtitle}</span>
              </div>
              {involved && <CircleDot className="ml-auto text-cyan-300" size={14} />}
            </div>
            {index < actors.length - 1 && (
              <div className={cn("actor-arrow", outgoing && "actor-arrow-active")}>
                <span>{outgoing ? selected.method : "HTTP"}</span>
                <ArrowRight size={18} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProtocolExplorer() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [traces, setTraces] = useState<ProtocolTrace[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [result, setResult] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    const [sessionResponse, traceResponse] = await Promise.all([
      fetch("/api/auth/session", { cache: "no-store" }),
      fetch("/api/traces", { cache: "no-store" }),
    ]);
    if (sessionResponse.ok) setSession((await sessionResponse.json()) as SessionView);
    if (traceResponse.ok) {
      const body = (await traceResponse.json()) as { traces: ProtocolTrace[] };
      setTraces(body.traces);
      setSelectedId((current) => current ?? body.traces.at(-1)?.stepId);
    }
  }, []);

  useEffect(() => {
    const noticeTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("labError");
      if (error === "pkce_or_token_exchange_failed") {
        setNotice("예상대로 token 교환이 거부되었습니다. Trace에서 PKCE 실패 응답을 확인하세요.");
      } else if (error) {
        setNotice(`실습 오류: ${error}`);
      } else if (params.get("login") === "success") {
        setNotice("OIDC 로그인이 완료되었습니다. Token은 BFF 세션에만 저장되었습니다.");
      }
      void load();
    }, 0);
    const timer = window.setInterval(() => void load(), 2_000);
    return () => {
      window.clearTimeout(noticeTimer);
      window.clearInterval(timer);
    };
  }, [load]);

  const selected = useMemo(
    () => traces.find((trace) => trace.stepId === selectedId) ?? traces.at(-1),
    [selectedId, traces],
  );

  async function resource(target: "profile" | "admin") {
    setBusy(target);
    setResult(undefined);
    try {
      const response = await fetch("/api/resource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const body = (await response.json()) as { status?: number; statusText?: string; error?: string };
      setResult(body.status ? `${body.status} ${body.statusText}` : `${response.status} ${body.error ?? response.statusText}`);
      await load();
      setSelectedId(undefined);
    } finally {
      setBusy(undefined);
    }
  }

  async function refresh() {
    setBusy("refresh");
    const response = await fetch("/api/auth/refresh", { method: "POST" });
    setResult(response.ok ? "200 Token refreshed" : `${response.status} Refresh failed`);
    await load();
    setSelectedId(undefined);
    setBusy(undefined);
  }

  async function reset() {
    setBusy("reset");
    await fetch("/api/lab/reset", { method: "POST" });
    setResult(undefined);
    setNotice("로컬 BFF 세션과 Trace를 초기화했습니다. Keycloak SSO 세션은 로그아웃으로 별도 종료하세요.");
    setSelectedId(undefined);
    await load();
    setBusy(undefined);
  }

  const claims = selected?.response.body && typeof selected.response.body === "object"
    ? selected.response.body
    : session?.token
      ? { idToken: session.token.idClaims, accessToken: session.token.accessClaims }
      : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="lab-grid-bg" />
      <header className="relative border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <Network size={23} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge>Interactive Lab</Badge>
                <Badge variant="muted">Phase 1</Badge>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">OAuth 2.0 & OpenID Connect</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">BFF session</p>
              <p className="text-sm font-semibold text-slate-200">
                {session?.authenticated ? session.user?.username : "Anonymous"}
              </p>
            </div>
            <span className={cn("status-dot", session?.authenticated && "status-dot-online")} />
            {session?.authenticated && (
              <a href="/api/auth/logout" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <LogOut size={14} /> 로그아웃
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-[1800px] px-5 py-7 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Protocol-first learning workspace</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">Protocol Explorer</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              로그인 버튼이 감추는 요청을 실제로 실행하고, Browser → BFF → Keycloak → API 경계를 단계별로 검사합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success"><LockKeyhole size={11} className="mr-1" /> secrets stay server-side</Badge>
            <Button variant="ghost" size="sm" onClick={reset} disabled={Boolean(busy)}>
              <RotateCcw size={14} className={busy === "reset" ? "animate-spin" : ""} /> 초기화
            </Button>
          </div>
        </div>

        {notice && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100">
            <CircleDot className="mt-0.5 shrink-0 text-cyan-300" size={16} />
            <span>{notice}</span>
          </div>
        )}

        <div className="explorer-layout">
          <Card className="panel-card">
            <CardHeader>
              <div className="panel-title"><BookOpen size={17} /><h3>실습 시나리오</h3></div>
              <p className="panel-subtitle">9 Chapters · progressive curriculum</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {chapters.map((item) => (
                  <div className={cn("chapter-row", item.status === "ready" && "chapter-row-ready")} key={item.chapter}>
                    <span className="chapter-index">{String(item.chapter).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-200">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.phase}</p>
                    </div>
                    {item.status === "ready" ? (
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    ) : item.status === "partial" ? (
                      <CircleDot size={15} className="text-amber-400" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-700" />
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-4">
                {!session?.authenticated ? (
                  <div className="space-y-2">
                    <a href="/api/auth/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                      <Play size={16} /> OIDC 로그인 시작
                    </a>
                    <a href="/api/auth/login?scenario=pkce-failure" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
                      <LockKeyhole size={15} /> 잘못된 PKCE 실습
                    </a>
                    <p className="text-center text-[11px] leading-5 text-slate-500">learner / learner</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button className="w-full" onClick={() => resource("profile")} disabled={Boolean(busy)}>
                      <ShieldCheck size={15} /> 사용자 API 호출
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() => resource("admin")} disabled={Boolean(busy)}>
                      <LockKeyhole size={15} /> 관리자 API 호출
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={refresh} disabled={Boolean(busy)}>
                      <RefreshCw size={15} className={busy === "refresh" ? "animate-spin" : ""} /> Token 갱신
                    </Button>
                  </div>
                )}
                {result && (
                  <div className={cn("mt-3 rounded-lg border px-3 py-2 text-center font-mono text-xs", result.startsWith("2") ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300")}>
                    {result}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-card center-panel">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="panel-title"><Network size={17} /><h3>Architecture</h3></div>
                  <p className="panel-subtitle">선택한 실측 요청에 따라 경로가 강조됩니다</p>
                </div>
                <Badge variant={selected?.observation === "observed" ? "success" : selected?.observation === "local-validation" ? "default" : "warning"}>
                  {selected?.observation ?? "waiting"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ArchitectureDiagram selected={selected} />
              <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-5">
                <div>
                  <p className="text-sm font-bold text-slate-100">HTTP Timeline</p>
                  <p className="text-xs text-slate-500">{traces.length} captured steps</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> observed</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> reconstructed</span>
                </div>
              </div>
              <div className="timeline mt-3">
                {traces.length === 0 ? (
                  <div className="empty-state">
                    <Network size={28} />
                    <strong>아직 HTTP Trace가 없습니다</strong>
                    <span>로그인을 시작하면 Discovery 요청부터 기록됩니다.</span>
                  </div>
                ) : (
                  traces.map((trace, index) => (
                    <button
                      className={cn("trace-row", selected?.stepId === trace.stepId && "trace-row-selected")}
                      key={trace.stepId}
                      onClick={() => setSelectedId(trace.stepId)}
                    >
                      <span className={cn("trace-dot", trace.observation === "reconstructed" && "trace-dot-reconstructed", trace.observation === "local-validation" && "trace-dot-local")} />
                      <span className="trace-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="trace-method">{trace.method}</span>
                      <span className="min-w-0 flex-1 truncate text-left text-xs text-slate-300">
                        {trace.source} <ArrowRight className="inline" size={11} /> {trace.destination}
                      </span>
                      <Badge variant={statusVariant(trace.response.status)}>
                        {trace.response.status || "…"}
                      </Badge>
                      <span className="hidden w-14 text-right font-mono text-[10px] text-slate-600 xl:block">{trace.duration}ms</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-card inspector-panel">
            <CardHeader>
              <div className="panel-title"><Server size={17} /><h3>HTTP Inspector</h3></div>
              <p className="panel-subtitle">마스킹된 request, response, JWT claims</p>
            </CardHeader>
            <CardContent>
              {selected ? (
                <>
                  <div className="request-summary">
                    <div className="flex items-center gap-2">
                      <span className="method-pill">{selected.method}</span>
                      <Badge variant={statusVariant(selected.response.status)}>
                        {selected.response.status || "pending"} {selected.response.statusText}
                      </Badge>
                    </div>
                    <p className="mt-3 break-all font-mono text-[11px] leading-5 text-slate-400">{selected.url}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{selected.source} → {selected.destination}</span>
                      <span>{selected.duration} ms</span>
                    </div>
                  </div>
                  <Tabs defaultValue="request" className="mt-4">
                    <TabsList>
                      <TabsTrigger value="request">Request</TabsTrigger>
                      <TabsTrigger value="response">Response</TabsTrigger>
                      <TabsTrigger value="claims">Claims</TabsTrigger>
                      <TabsTrigger value="why">Why</TabsTrigger>
                    </TabsList>
                    <TabsContent value="request"><JsonBlock value={selected.request} /></TabsContent>
                    <TabsContent value="response"><JsonBlock value={selected.response} /></TabsContent>
                    <TabsContent value="claims"><JsonBlock value={claims} /></TabsContent>
                    <TabsContent value="why">
                      <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Step explanation</p>
                        {selected.explanation}
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-800 p-4 text-xs leading-5 text-slate-500">
                        <strong className="text-slate-300">Evidence:</strong> {selected.observation === "observed" ? "실제 BFF 입출력 또는 server-to-server fetch" : selected.observation === "local-validation" ? "서버 내부 암호학적 검증" : "관측 가능한 redirect 정보를 이용한 재구성"}
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <div className="empty-state min-h-80">
                  <Server size={28} />
                  <strong>검사할 요청을 선택하세요</strong>
                  <span>Timeline의 단계가 여기에 method, header, body, claim으로 표시됩니다.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
