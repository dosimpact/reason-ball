"use client";

import { createUuid } from "@/shared/lib/uuid";
import { LogOut, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { createDraftStorage } from "@/entities/chat";

type SessionUser = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  createdAt: string;
};

type Mode = "sign-in" | "sign-up";
const storageKey = "lingua-auth-session";

function mockGuest(): SessionUser {
  return {
    id: createUuid(),
    email: null,
    isAnonymous: true,
    createdAt: new Date().toISOString(),
  };
}

function isMockRuntime() {
  return process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "mock" || process.env.NEXT_PUBLIC_DATA_PROVIDER !== "supabase";
}

export function AuthSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [switchAccount, setSwitchAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function ensureSession() {
      if (isMockRuntime()) {
        const stored = localStorage.getItem(storageKey);
        const nextUser = stored ? JSON.parse(stored) as SessionUser : mockGuest();
        if (!stored) localStorage.setItem(storageKey, JSON.stringify(nextUser));
        if (active) setUser(nextUser);
        return;
      }
      const nextUser = await ensureBrowserSession();
      if (active) setUser(nextUser);
    }
    void ensureSession().catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isMockRuntime()) {
        const nextUser: SessionUser = {
          ...(user ?? mockGuest()),
          email: email.trim().toLowerCase(),
          isAnonymous: false,
        };
        localStorage.setItem(storageKey, JSON.stringify(nextUser));
        setUser(nextUser);
        setNotice(mode === "sign-in" ? "로그인했어요. 게스트 학습 기록도 그대로예요." : "계정을 연결했어요. 게스트 학습 기록을 보존했습니다.");
        return;
      }

      const action = mode === "sign-in" ? "sign-in" : user?.isAnonymous ? "link-email" : "sign-up";
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          email: email.trim().toLowerCase(),
          ...(action === "link-email" ? {} : { password }),
          ...(action === "sign-in" ? { switchAccount } : { next: "/profile" }),
        }),
      });
      const payload = await response.json() as {
        user?: SessionUser | null;
        emailConfirmationRequired?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "인증 요청을 처리하지 못했어요.");
      if (payload.user) setUser(payload.user);
      setNotice(payload.emailConfirmationRequired ? "확인 메일을 보냈어요. 링크를 열면 기존 게스트 기록과 연결됩니다." : "로그인했어요.");
      // A full navigation drops the previous account's in-memory chat/query state.
      if (payload.user && !payload.emailConfirmationRequired) window.location.replace(new URL("/profile", window.location.origin).href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "인증 요청을 처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function setAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-password", password: newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "비밀번호를 설정하지 못했어요.");
      setNewPassword("");
      setNotice("비밀번호를 설정했어요. 다음에는 이메일과 비밀번호로 로그인할 수 있어요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "비밀번호를 설정하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      if (!isMockRuntime()) {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
        try { createDraftStorage(window.localStorage).clearAll(); }
        catch { window.alert("로그아웃했지만 로컬 초안을 지우지 못했어요. 공용 기기에서는 브라우저 사이트 데이터를 삭제해 주세요."); }
        window.location.replace(new URL("/profile", window.location.origin).href);
        return;
      }
      const guest = mockGuest();
      localStorage.setItem(storageKey, JSON.stringify(guest));
      setUser(guest);
      setNotice("로그아웃했어요. 이 브라우저에서는 게스트로 계속 학습할 수 있어요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그아웃하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setError(""); setNotice(""); }} className="flex min-h-10 items-center gap-2 rounded-xl border border-black/8 bg-white px-2.5 text-xs font-black shadow-sm dark:border-white/15 dark:bg-neutral-900 sm:px-3" data-testid="auth-session"><UserRound className="size-4" /><span className="hidden max-w-32 truncate sm:inline">{user?.isAnonymous !== false ? "게스트" : user.email}</span></button>
      {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title"><section className="w-full max-w-md rounded-[1.75rem] bg-white p-6 text-neutral-950 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#5763d7]">Account</p><h2 id="auth-title" className="mt-2 text-2xl font-black">학습 기록을 안전하게 이어가요</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="계정 창 닫기" className="message-action"><X /></button></div><div className="mt-5 rounded-2xl bg-[#f7f4ef] p-4 text-sm"><p className="font-black">현재 · {user?.isAnonymous !== false ? "익명 게스트" : user.email}</p><p className="mt-1 text-xs leading-5 text-neutral-500">가입할 때 캐릭터, 미션, 대화 기록을 같은 사용자로 연결합니다.</p></div>{user?.isAnonymous === false ? <div className="mt-5">{!isMockRuntime() ? <form onSubmit={setAccountPassword} className="mb-5 space-y-3"><label className="block text-sm font-bold">새 비밀번호<input required minLength={8} type="password" autoComplete="new-password" className="form-field" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><button type="submit" disabled={busy} className="w-full rounded-full bg-neutral-950 py-3 text-sm font-black text-white disabled:opacity-50">비밀번호 설정</button></form> : null}<button type="button" onClick={() => void logout()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/10 py-3 text-sm font-black"><LogOut className="size-4" /> 로그아웃</button>{error ? <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}{notice ? <p role="status" className="mt-3 text-sm font-bold text-emerald-700">{notice}</p> : null}</div> : <><div className="mt-5 grid grid-cols-2 rounded-xl bg-neutral-100 p-1" role="tablist" aria-label="인증 방식"><button type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => setMode("sign-in")} className={`rounded-lg py-2 text-xs font-black ${mode === "sign-in" ? "bg-white shadow-sm" : "text-neutral-500"}`}>로그인</button><button type="button" role="tab" aria-selected={mode === "sign-up"} onClick={() => setMode("sign-up")} className={`rounded-lg py-2 text-xs font-black ${mode === "sign-up" ? "bg-white shadow-sm" : "text-neutral-500"}`}>가입·연결</button></div><form onSubmit={submit} className="mt-5 space-y-4">{mode === "sign-in" && user?.isAnonymous && !isMockRuntime() ? <label className="flex items-start gap-2 text-xs leading-5"><input required type="checkbox" checked={switchAccount} onChange={(event) => setSwitchAccount(event.target.checked)} />기존 계정으로 전환합니다. 현재 게스트 기록은 연결되지 않으며, 이메일을 연결하지 않았다면 다시 접근할 수 없어요.</label> : null}<label className="block text-sm font-bold">이메일<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="form-field" /></label>{mode === "sign-in" || !user?.isAnonymous ? <label className="block text-sm font-bold">비밀번호<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className="form-field" /></label> : <p className="rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">게스트 계정에는 확인 메일로 이메일을 먼저 연결합니다. 확인 후 비밀번호를 설정할 수 있어요.</p>}{error ? <p role="alert" className="text-sm font-bold text-red-600">{error}</p> : null}{notice ? <p role="status" className="text-sm font-bold text-emerald-700">{notice}</p> : null}<button type="submit" disabled={busy} className="w-full rounded-full bg-neutral-950 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "처리 중..." : mode === "sign-in" ? "로그인" : "기록을 보존하고 연결"}</button></form></>}</section></div> : null}
    </>
  );
}
