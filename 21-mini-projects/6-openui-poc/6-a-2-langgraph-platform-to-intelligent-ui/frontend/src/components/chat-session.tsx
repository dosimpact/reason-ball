"use client";

import { useEffect, useRef } from "react";
import { useThreadList } from "@openuidev/react-ui";

const SELECTED_THREAD = "oiu:selected-thread";

/** Restore the open report/chat as well as its already-persisted messages and UI state. */
export function ChatSession() {
  const restored = useRef(false);
  const threadId = useThreadList((s) => s.selectedThreadId);
  const threads = useThreadList((s) => s.threads);
  const loading = useThreadList((s) => s.isLoadingThreads);
  const selectThread = useThreadList((s) => s.selectThread);

  useEffect(() => {
    // ChatProvider begins loading in its mount effect. Wait for actual rows,
    // rather than treating its initial false flag as a completed empty load.
    if (loading || (!restored.current && threads.length === 0 && !threadId)) return;
    try {
      if (!restored.current) {
        restored.current = true;
        const saved = localStorage.getItem(SELECTED_THREAD);
        if (!threadId && saved && threads.some((thread) => thread.id === saved)) {
          selectThread(saved);
          return;
        }
      }
      if (threadId) localStorage.setItem(SELECTED_THREAD, threadId);
      else localStorage.removeItem(SELECTED_THREAD);
    } catch {
      // Match the existing chat storage: blocked/full storage must not stop chat.
    }
  }, [threadId, threads, loading, selectThread]);
  return null;
}
