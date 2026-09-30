export type BrowserSessionUser = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  createdAt: string;
};

let preparing: Promise<BrowserSessionUser> | undefined;

async function guestSessionError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as {
    error?: { code?: string };
  } | null;
  const code = payload?.error?.code;
  if (code === "CROSS_SITE_REQUEST_BLOCKED" || code === "INVALID_REQUEST_ORIGIN") {
    return new Error("현재 접속 주소에서 게스트 로그인이 허용되지 않았어요. 주소창의 전체 URL을 관리자에게 알려 주세요.");
  }
  if (response.status === 429) {
    return new Error("게스트 로그인 요청이 많아 잠시 제한되었어요. 잠시 후 다시 시도해 주세요.");
  }
  if (code === "CAPTCHA_REQUIRED") {
    return new Error("게스트 로그인에 보안 인증이 필요해요. 관리자에게 문의해 주세요.");
  }
  const requestId = response.headers.get("x-request-id");
  return new Error(`게스트 세션을 준비하지 못했어요. 다시 시도해 주세요. (HTTP ${response.status}${requestId ? `, 요청 ${requestId}` : ""})`);
}

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
  if (!created.ok) throw await guestSessionError(created);
  const payload = await created.json() as { user: BrowserSessionUser };
  if (!payload.user?.id) throw new Error("유효한 로그인 세션을 확인하지 못했어요.");
  return payload.user;
}

export function ensureBrowserSession(): Promise<BrowserSessionUser> {
  // Share only in-flight work, never cache a user across logout or account change.
  preparing ??= loadOrCreateSession().finally(() => { preparing = undefined; });
  return preparing;
}
