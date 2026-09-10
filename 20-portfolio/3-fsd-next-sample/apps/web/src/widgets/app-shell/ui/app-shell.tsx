"use client";

import {
  Clock3,
  Compass,
  Flame,
  Home,
  Map,
  Menu,
  MessageCircle,
  Plus,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ThemeToggle } from "@/features/theme-toggle";
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

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const progress = useLearningProgressQuery();
  const streak = progress.isError ? undefined : progress.data?.streak;
  const menuOpen = useMobileMenuStore((state) => state.isOpen);
  const closeMenu = useMobileMenuStore((state) => state.close);
  const toggleMenu = useMobileMenuStore((state) => state.toggle);

  const startNewChat = useCallback(() => {
    const conversationId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `conversation-${Date.now()}`;
    router.push(`/chat/mia-hotelier?conversation=${conversationId}&new=1`);
  }, [router]);

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
    <div ref={shellRef} data-testid="app-shell" data-shortcuts-ready="false" className="min-h-svh bg-[#f7f4ef] text-[#1c1b19] transition-colors dark:bg-neutral-950 dark:text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-black/6 bg-[#f7f4ef]/90 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Lingua 캐릭터 랩 홈"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#f06f52] text-white shadow-[0_8px_22px_-10px_#e15a3a]">
              <MessageCircle className="size-5 fill-current" aria-hidden="true" />
            </span>
            <span className="font-black tracking-[-0.04em]">Lingua</span>
            <span className="hidden rounded-full bg-[#ece7df] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-neutral-500 sm:inline">
              character lab
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="주요 메뉴">
            {navItems.map((item) => {
              const active = isCurrent(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    active
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-500 hover:bg-white hover:text-neutral-950"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <AuthSession />
            <ThemeToggle />
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-2 text-xs font-bold shadow-sm sm:flex"
              data-testid="header-learning-streak"
              aria-label={streak === undefined ? "학습 진도 확인" : `${streak}일 연속 학습, 학습 진도 확인`}
            >
              <Flame className="size-4 fill-orange-400 text-orange-500" aria-hidden="true" />
              {streak === undefined ? "진도 확인" : `${streak}일`}
            </Link>
            <button
              type="button"
              onClick={startNewChat}
              className="hidden items-center gap-1.5 rounded-full bg-[#f06f52] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#dd5c3f] sm:flex"
              aria-keyshortcuts="Meta+Shift+O Control+Shift+O"
              data-testid="new-chat-button"
            >
              <Plus className="size-4" aria-hidden="true" /> 새 채팅
            </button>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl border border-black/8 bg-white lg:hidden"
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
              onClick={toggleMenu}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            className="border-t border-black/6 bg-[#f7f4ef] px-4 py-3 dark:border-white/10 dark:bg-neutral-950 lg:hidden"
            aria-label="모바일 메뉴"
          >
            <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-2 sm:grid-cols-5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isCurrent(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-neutral-950 text-white" : "bg-white"}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <aside className="fixed inset-y-16 left-0 z-30 hidden w-64 flex-col border-r border-black/6 bg-white/65 px-4 py-5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/75 lg:flex" aria-label="데스크톱 사이드바">
        <button
          type="button"
          onClick={startNewChat}
          className="flex min-h-12 items-center justify-between rounded-2xl bg-neutral-950 px-4 text-sm font-black text-white transition hover:bg-[#f06f52] dark:bg-white dark:text-neutral-950"
          aria-keyshortcuts="Meta+Shift+O Control+Shift+O"
          data-testid="sidebar-new-chat"
        >
          <span className="flex items-center gap-2"><Plus className="size-4" />새 채팅</span>
          <kbd className="rounded-md bg-white/15 px-1.5 py-1 text-[9px] font-semibold dark:bg-black/10">⇧⌘O</kbd>
        </button>
        <nav className="mt-5 space-y-1" aria-label="사이드바 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-[#fff0eb] text-[#c94e34] dark:bg-[#f06f52]/20 dark:text-[#ffab97]" : "text-neutral-600 hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-900"}`}
              >
                <Icon className="size-4" aria-hidden="true" />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-black/6 pt-5 dark:border-white/10">
          <p className="px-3 text-[10px] font-black uppercase tracking-[.16em] text-neutral-400">빠른 연습</p>
          <Link href="/missions/hotel-check-in" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold hover:bg-white dark:hover:bg-neutral-900">
            <span className="grid size-8 place-items-center rounded-lg bg-[#fff0eb]">🏨</span>
            호텔 체크인
          </Link>
          <Link href="/missions/coffee-order" className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold hover:bg-white dark:hover:bg-neutral-900">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-50">☕</span>
            카페 주문
          </Link>
        </div>
        <div className="mt-auto rounded-2xl bg-[#f1f2ff] p-4 text-[#353b84] dark:bg-indigo-950 dark:text-indigo-100">
          <Sparkles className="size-4" />
          <p className="mt-2 text-xs font-black">오늘 7분만 말해 볼까요?</p>
          <p className="mt-1 text-[11px] leading-4 opacity-70">짧은 실전 미션 하나면 충분해요.</p>
        </div>
      </aside>

      <main className="lg:pl-64">{children}</main>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-black/8 bg-white/95 p-1.5 shadow-[0_18px_60px_-18px_rgba(0,0,0,.4)] backdrop-blur-lg lg:hidden"
        aria-label="하단 메뉴"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrent(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold ${active ? "bg-neutral-950 text-white" : "text-neutral-500"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
