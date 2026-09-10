export type BrowserSessionUser = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  createdAt: string;
};

let preparing: Promise<BrowserSessionUser> | undefined;

async function loadOrCreateSession(): Promise<BrowserSessionUser> {
  const existing = await fetch("/api/auth/session", { cache: "no-store" });
  if (!existing.ok) throw new Error("로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.");
  const session = await existing.json() as { user: BrowserSessionUser | null };
  if (session.user) return session.user;
  const created = await fetch("/api/auth/anonymous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!created.ok) throw new Error("게스트 세션을 준비하지 못했어요. 다시 시도해 주세요.");
  const payload = await created.json() as { user: BrowserSessionUser };
  if (!payload.user?.id) throw new Error("유효한 로그인 세션을 확인하지 못했어요.");
  return payload.user;
}

export function ensureBrowserSession(): Promise<BrowserSessionUser> {
  // Share only in-flight work, never cache a user across logout or account change.
  preparing ??= loadOrCreateSession().finally(() => { preparing = undefined; });
  return preparing;
}
