import type { ReactNode } from "react";

/** A definite height lets CopilotChat scroll messages instead of growing the page. */
export function ChatViewport({ children }: { children: ReactNode }) {
  return <div aria-label="채팅 결과" className="h-[70dvh] max-h-[900px] min-h-0 min-w-0 overflow-y-auto rounded-xl border">{children}</div>;
}
