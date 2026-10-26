"use client";

import { useEffect, useRef } from "react";
import { useThread, useThreadList, type ChatStorage, type Message, type Thread } from "@openuidev/react-ui";
import demoThreads from "@/data/demo-threads.json";

const PREFIX = "openui-shadcn-langgraph:v1:";
const THREADS = `${PREFIX}threads`;
const SEEDED = `${PREFIX}seeded`;
const SELECTED = `${PREFIX}selected`;
const messagesKey = (id: string) => `${PREFIX}messages:${id}`;
type Demo = { thread: Thread; messages: Message[] };
const demos = demoThreads as unknown as Demo[];

// Keep chat usable if localStorage is blocked or full, without touching other apps.
const memory = new Map<string, string>();
function read<T>(key: string, fallback: T): T {
  let raw: string | null | undefined;
  try { raw = localStorage.getItem(key); } catch { /* Use memory below. */ }
  raw ??= memory.get(key);
  try { return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try { localStorage.setItem(key, raw); } catch { /* Session-only fallback. */ }
}

function seedOnce() {
  if (read(SEEDED, false) || demos.length === 0) return;
  const existing = read<Thread[]>(THREADS, []);
  const ids = new Set(existing.map(thread => thread.id));
  const added = demos.filter(demo => !ids.has(demo.thread.id));
  for (const demo of added) write(messagesKey(demo.thread.id), demo.messages);
  // Append examples; existing conversations and edits always win.
  write(THREADS, [...existing, ...added.map(demo => demo.thread)]);
  write(SEEDED, true);
}

export function localChatStorage(): ChatStorage {
  return { thread: {
    async listThreads() {
      seedOnce();
      return { threads: read<Thread[]>(THREADS, []) };
    },
    async createThread(firstMessage) {
      const content = typeof firstMessage.content === "string" ? firstMessage.content : "New chat";
      const thread = { id: crypto.randomUUID(), title: content.replace(/\s+/g, " ").trim().slice(0, 60), createdAt: new Date().toISOString() };
      write(THREADS, [thread, ...read<Thread[]>(THREADS, [])]);
      write(messagesKey(thread.id), [firstMessage]);
      return thread;
    },
    async getMessages(id) { return read<Message[]>(messagesKey(id), []); },
    async updateThread(thread) {
      write(THREADS, read<Thread[]>(THREADS, []).map(old => old.id === thread.id ? { ...old, ...thread, isPending: undefined } : old));
      return thread;
    },
    async deleteThread(id) {
      write(THREADS, read<Thread[]>(THREADS, []).filter(thread => thread.id !== id));
      memory.delete(messagesKey(id));
      try { localStorage.removeItem(messagesKey(id)); } catch { /* Already removed in memory. */ }
    },
  } };
}

/** Persist completed messages and interactive OpenUI state; restore the last thread. */
export function ChatHistory() {
  const messages = useThread(state => state.messages);
  const running = useThread(state => state.isRunning);
  const loadingMessages = useThread(state => state.isLoadingMessages);
  const threadId = useThreadList(state => state.selectedThreadId);
  const threads = useThreadList(state => state.threads);
  const loadingThreads = useThreadList(state => state.isLoadingThreads);
  const selectThread = useThreadList(state => state.selectThread);
  const restored = useRef(false);

  useEffect(() => {
    if (loadingThreads || threads.length === 0) return;
    if (!restored.current) {
      restored.current = true;
      const saved = read<string | null>(SELECTED, null);
      const initial = threads.find(thread => thread.id === saved) ?? threads.find(thread => thread.id.startsWith("shadcn-demo-v1-"));
      if (!threadId && initial) { selectThread(initial.id); return; }
    }
    write(SELECTED, threadId);
  }, [threadId, threads, loadingThreads, selectThread]);

  useEffect(() => {
    if (threadId && !running && !loadingMessages && messages.length > 0) write(messagesKey(threadId), messages);
  }, [threadId, running, loadingMessages, messages]);
  return null;
}
