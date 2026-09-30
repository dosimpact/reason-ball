"use client";

import {
  Clock3,
  Compass,
  Flame,
  FlaskConical,
  Home,
  Map,
  Menu,
  MessageCircle,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/features/theme-toggle";
import { useCharactersQuery } from "@/entities/character";
import { AuthSession } from "@/features/auth-session";
import { useLearningProgressQuery } from "@/entities/learning-session";
import { useMobileMenuStore } from "@/shared/model";

const navItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/characters", label: "캐릭터", icon: Compass },
  { href: "/missions", label: "미션", icon: Map },
  { href: "/history", label: "대화 기록", icon: Clock3 },
  { href: "/profile", label: "프로필", icon: UserRound },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname.startsWith(href);
}

type AppShellProps = { children: ReactNode; showPlayground?: boolean };

export function AppShell({ children, showPlayground = false }: AppShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { data: characters, refetch: refreshCharacters } = useCharactersQuery();
  const startingChat = useRef(false);
  const [chatError, setChatError] = useState("");
  const progress = useLearningProgressQuery();
  const streak = progress.isError ? undefined : progress.data?.streak;
  const menuOpen = useMobileMenuStore((state) => state.isOpen);
  const closeMenu = useMobileMenuStore((state) => state.close);
  const toggleMenu = useMobileMenuStore((state) => state.toggle);

  const startNewChat = useCallback(async () => {
    if (startingChat.current) return;
    startingChat.current = true;
    setChatError("");
    try {
      // The shell can hydrate before its catalog. Keep the user's click pending
      // until that request finishes instead of redirecting to discovery.
      const available = characters ?? (await refreshCharacters({ cancelRefetch: false })).data;
      if (!available) {
        setChatError("대화 상대를 불러오지 못했어요. 새 채팅을 다시 눌러 주세요.");
        return;
      }
      const character = available.find((item) => item.publishStatus !== "archived");
      if (!character) { router.push("/characters"); return; }
      router.push(`/chat/${encodeURIComponent(character.id)}?attempt=new`);
    } finally {
      startingChat.current = false;
    }
  }, [characters, refreshCharacters, router]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        startNewChat();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    // Theme/bootstrap scripts can run before this listener exists. Expose the
    // actual listener lifecycle, not an inferred readiness from rendered HTML.
    const shell = shellRef.current;
    shell?.setAttribute("data-shortcuts-ready", "true");
    return () => {
      shell?.setAttribute("data-shortcuts-ready", "false");
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [startNewChat]);

  return (
    <div ref={shellRef} data-testid="app-shell" data-shortcuts-ready="false" className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <Link href="/" aria-label="Lingua 캐릭터 랩 홈" className="mb-10 flex items-center gap-2 px-2 text-3xl font-black tracking-tight"><MessageCircle className="size-8" /> Lingua<span className="text-primary">.</span></Link>
        <Link href="/characters/new" className="mb-7 flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"><Plus className="size-4" /> 캐릭터 만들기</Link>
        <nav aria-label="주요 메뉴" className="space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isCurrent(pathname, href) ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}><Icon className="size-5" />{label}</Link>)}
        </nav>
        <button type="button" onClick={startNewChat} aria-keyshortcuts="Meta+Shift+O Control+Shift+O" data-testid="new-chat-button" className="mt-6 flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"><Plus className="size-5" /> 새 채팅</button>
        <div className="mt-auto space-y-5 border-t border-border pt-5">
          {showPlayground ? <Link href="/admin/playground" className="flex items-center gap-2 text-xs text-muted-foreground"><FlaskConical className="size-4" />AI Playground</Link> : null}
          <Link href="/profile" data-testid="header-learning-streak" className="flex items-center gap-2 text-xs text-muted-foreground" aria-label={streak === undefined ? "학습 진도 확인" : `${streak}일 연속 학습, 학습 진도 확인`}><Flame className="size-4" />{streak === undefined ? "나의 학습 진도" : `${streak}일 연속 학습`}</Link>
          <div className="flex items-center justify-between"><AuthSession /><ThemeToggle /></div>
          <p className="text-[11px] text-muted-foreground">한국어 · AI 캐릭터와 배우는 영어</p>
        </div>
      </aside>
      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 px-4 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center gap-4">
            <Link href="/" className="text-xl font-black tracking-tight lg:hidden">Lingua.</Link>
            <form action="/characters" className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input name="q" type="search" aria-label="캐릭터 찾아보기" placeholder="어떤 캐릭터와 이야기하고 싶나요?" className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground" />
              <button className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">검색</button>
            </form>
            <button type="button" onClick={toggleMenu} aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen} className="grid size-10 shrink-0 place-items-center rounded-full border border-border lg:hidden">{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
          </div>
          {menuOpen ? <nav aria-label="모바일 메뉴" className="mt-4 space-y-2 lg:hidden">
            {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={closeMenu} className="flex items-center gap-3 rounded-xl bg-card p-3 text-sm"><Icon className="size-4" />{label}</Link>)}
            <Link href="/characters/new" onClick={closeMenu} className="flex items-center gap-3 rounded-xl bg-primary p-3 text-sm text-primary-foreground"><Plus className="size-4" />캐릭터 만들기</Link>
            {showPlayground ? <Link href="/admin/playground" onClick={closeMenu} className="flex items-center gap-3 rounded-xl bg-card p-3 text-sm"><FlaskConical className="size-4" />AI Playground</Link> : null}
            <button type="button" onClick={() => { closeMenu(); void startNewChat(); }} className="w-full rounded-xl border border-border p-3 text-left text-sm">새 채팅</button>
            <div className="flex items-center justify-between py-2"><AuthSession /><ThemeToggle /></div>
          </nav> : null}
        </header>
        {chatError ? <p role="alert" className="px-4 py-2 text-sm text-destructive">{chatError}</p> : null}
        <main>{children}</main>
      </div>
      <nav aria-label="하단 메뉴" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar/95 p-2 backdrop-blur-xl lg:hidden">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${isCurrent(pathname, href) ? "bg-sidebar-accent text-foreground" : "text-muted-foreground"}`}><Icon className="size-4" />{label}</Link>)}
      </nav>
    </div>
  );
}
