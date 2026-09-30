/** @jsxImportSource react */
"use client";

import { AlertCircle, LoaderCircle, Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { useUiMessages } from "@/shared/i18n/ui-messages-provider";

import { audioPlaybackController } from "../model/audio-controller";
import { defaultPreferences, useLearningPreferences } from "@/entities/learner";

const voices = [
  { value: "marin", label: "Marin" },
  { value: "coral", label: "Coral" },
  { value: "alloy", label: "Alloy" },
] as const;

export function AudioPlaybackButton({
  playbackId,
  text,
  messageId,
  messageRevision = 1,
  defaultVoice,
  defaultRate,
  autoplay,
  autoPlayOnMount = false,
  showSettings = false,
  compact = false,
}: {
  playbackId: string;
  text: string;
  messageId?: string;
  messageRevision?: number;
  defaultVoice?: string;
  defaultRate?: number;
  autoplay?: boolean;
  autoPlayOnMount?: boolean;
  showSettings?: boolean;
  compact?: boolean;
}) {
  const { audio: copy, languageTag } = useUiMessages();
  const requiresPreferences = defaultVoice === undefined || defaultRate === undefined || autoplay === undefined;
  const preferences = useLearningPreferences(requiresPreferences);
  const defaults = preferences.data?.settings ?? defaultPreferences;
  const [voiceOverride, setVoice] = useState<string>();
  const [rateOverride, setRate] = useState<number>();
  const voice = voiceOverride ?? defaultVoice ?? defaults.voice;
  const rate = rateOverride ?? defaultRate ?? defaults.rate;
  const shouldAutoplay = autoplay ?? defaults.autoplay;
  const preferencesReady = !requiresPreferences || preferences.isSuccess;
  const autoplayAttempt = useRef<string | undefined>(undefined);
  const settingsId = useId();
  const snapshot = useSyncExternalStore(
    audioPlaybackController.subscribe,
    audioPlaybackController.getSnapshot,
    audioPlaybackController.getServerSnapshot,
  );
  const isCurrent = snapshot.playbackId === playbackId;
  const status = isCurrent ? snapshot.status : "idle";

  useEffect(() => {
    if (!autoPlayOnMount || !shouldAutoplay || !preferencesReady) return;
    const attempt = `${playbackId}:${messageRevision}`;
    if (autoplayAttempt.current === attempt) return;
    autoplayAttempt.current = attempt;
    void audioPlaybackController.load(
      { id: playbackId, text, messageId, messageRevision, voice, rate, autoplay: shouldAutoplay },
      true,
    );
    return () => {
      if (audioPlaybackController.getSnapshot().playbackId === playbackId) {
        audioPlaybackController.stop();
      }
    };
  }, [autoPlayOnMount, shouldAutoplay, preferencesReady, messageId, messageRevision, playbackId, rate, text, voice]);

  const label = copy.labels[status];
  const announcement = copy.announcements[status];
  const Icon =
    status === "loading"
      ? LoaderCircle
      : status === "playing"
        ? Pause
        : status === "error"
          ? AlertCircle
          : status === "paused"
            ? Play
            : Volume2;

  return (
    <div lang={languageTag} className="inline-flex flex-col items-start gap-2" data-testid={`audio-playback-${playbackId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={label}
          disabled={status === "loading" || !preferencesReady}
          onClick={() =>
            void audioPlaybackController.toggle({
              id: playbackId,
              text,
              messageId,
              messageRevision,
              voice,
              rate,
              autoplay: shouldAutoplay,
            })
          }
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 font-bold text-white transition hover:bg-[#5763d7] disabled:cursor-wait disabled:opacity-65 ${compact ? "size-9 text-xs" : "px-4 py-2.5 text-xs"}`}
        >
          <Icon className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
          {!compact ? label : null}
        </button>
        {showSettings ? (
          <div id={settingsId} className="flex items-center gap-2 text-xs">
            <label className="sr-only" htmlFor={`${settingsId}-voice`}>{copy.voice}</label>
            <select
              id={`${settingsId}-voice`}
              value={voice}
              onChange={(event) => setVoice(event.target.value)}
              className="rounded-full border border-black/10 bg-white px-3 py-2 font-semibold"
            >
              {voices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="sr-only" htmlFor={`${settingsId}-rate`}>{copy.rate}</label>
            <select
              id={`${settingsId}-rate`}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              className="rounded-full border border-black/10 bg-white px-3 py-2 font-semibold"
            >
              {[0.75, 1, 1.25].map((value) => <option key={value} value={value}>{value}×</option>)}
            </select>
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
      <p className="text-[10px] font-medium text-neutral-400">{copy.disclosure}</p>
      {requiresPreferences && preferences.isError ? <button type="button" onClick={() => void preferences.refetch()} className="text-xs text-red-700">{copy.reloadPreferences}</button> : null}
      {status === "error" ? <p role="alert" className="text-xs font-semibold text-red-600">{snapshot.error}</p> : null}
    </div>
  );
}
