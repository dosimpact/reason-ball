"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TodoStore } from "../shared/todo";
export function useTodos() {
  const [store, setStore] = useState<TodoStore>({
    version: 1,
    revision: -1,
    todos: [],
  });
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("연결 중");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/todos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (active.current) {
        setStore((old) => (data.revision >= old.revision ? data : old));
        setError("");
      }
    } catch (error) {
      if (active.current)
        setError(error instanceof Error ? error.message : "조회 실패");
    }
  }, []);
  useEffect(() => {
    active.current = true;
    let events: EventSource | undefined;
    const connect = () => {
      events?.close();
      events = new EventSource("/api/events");
      events.addEventListener("ready", () => {
        setConnection("실시간 연결됨");
        void refresh();
      });
      events.onmessage = () => {
        void refresh();
      };
      events.onerror = () => setConnection("재연결 중");
    };
    const offline = () => {
      events?.close();
      setConnection("오프라인");
    };
    window.addEventListener("online", connect);
    window.addEventListener("offline", offline);
    connect();
    const initialRefresh = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      active.current = false;
      clearTimeout(initialRefresh);
      events?.close();
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", offline);
    };
  }, [refresh]);
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/todos" + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장 실패");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { store, error, connection, busy, mutate, refresh };
}
