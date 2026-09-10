"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isRecentLearningActivity } from "../model/activity";
import { createActivityRecorder } from "./activity-recorder";
import { localActivityFetch } from "./local-activity-repository";

export function useLearningActivity(conversationId: string, remote: boolean) {
  const client = useQueryClient();
  const [warning, setWarning] = useState<string>();
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    let lastInteraction: number | null = null;
    let disposed = false;
    let active = false;
    const recorder = createActivityRecorder(conversationId,
      () => { void client.invalidateQueries({ queryKey: ["learning-progress"] }); },
      (message) => { if (!disposed) setWarning(message); }, remote ? fetch : localActivityFetch);
    const tick = () => {
      active = isRecentLearningActivity({ visible: document.visibilityState === "visible", focused: document.hasFocus(), now: performance.now(), lastInteraction });
      void recorder.pulse(active);
    };
    const interact = (event: Event) => {
      if (!event.isTrusted) return;
      lastInteraction = performance.now();
      if (!active) tick();
    };
    const leave = () => { active = false; void recorder.pulse(false); };
    const timer = window.setInterval(tick, 15_000);
    retry.current = tick;
    window.addEventListener("keydown", interact, true);
    window.addEventListener("pointerdown", interact, true);
    window.addEventListener("input", interact, true);
    window.addEventListener("focus", tick);
    window.addEventListener("blur", leave);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", tick);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("keydown", interact, true);
      window.removeEventListener("pointerdown", interact, true);
      window.removeEventListener("input", interact, true);
      window.removeEventListener("focus", tick);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", tick);
      retry.current = () => {};
      leave();
    };
  }, [client, conversationId, remote]);
  return { warning, retry: () => retry.current() };
}
