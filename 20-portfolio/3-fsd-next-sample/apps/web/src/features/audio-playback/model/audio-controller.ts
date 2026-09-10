"use client";

export type AudioPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

export type AudioPlaybackSnapshot = {
  playbackId?: string;
  status: AudioPlaybackStatus;
  voice: string;
  rate: number;
  autoplay: boolean;
  error?: string;
};

export type AudioPlaybackRequest = {
  id: string;
  text: string;
  messageId?: string;
  messageRevision?: number;
  voice?: string;
  rate?: number;
  autoplay?: boolean;
};

const initialSnapshot: AudioPlaybackSnapshot = {
  status: "idle",
  voice: "marin",
  rate: 1,
  autoplay: false,
};

class AudioPlaybackController {
  private snapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private audio?: HTMLAudioElement;
  private objectUrl?: string;
  private request?: AbortController;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initialSnapshot;

  private publish(next: AudioPlaybackSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private releaseCurrent() {
    this.request?.abort();
    this.request = undefined;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = undefined;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
  }

  async toggle(options: AudioPlaybackRequest) {
    if (this.snapshot.playbackId === options.id && this.audio) {
      if (this.snapshot.status === "playing") {
        this.audio.pause();
        this.publish({ ...this.snapshot, status: "paused", error: undefined });
        return;
      }
      if (this.snapshot.status === "paused") {
        await this.audio.play();
        this.publish({ ...this.snapshot, status: "playing", error: undefined });
        return;
      }
    }
    await this.load(options, true);
  }

  async load(options: AudioPlaybackRequest, playWhenReady = options.autoplay ?? false) {
    this.releaseCurrent();
    const request = new AbortController();
    this.request = request;
    const voice = options.voice ?? "marin";
    const rate = options.rate ?? 1;
    const autoplay = options.autoplay ?? false;
    this.publish({ playbackId: options.id, status: "loading", voice, rate, autoplay });
    try {
      const response = await fetch("/api/ai/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: options.text,
          voice,
          speed: rate,
          messageId: options.messageId,
          messageRevision: options.messageRevision ?? 1,
        }),
        signal: request.signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => undefined)) as
          | { error?: { message?: string }; message?: string }
          | undefined;
        throw new Error(payload?.error?.message ?? payload?.message ?? "음성을 불러오지 못했어요.");
      }
      const blob = await response.blob();
      if (request.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      this.objectUrl = objectUrl;
      this.audio = audio;
      audio.addEventListener("ended", () => {
        if (this.audio === audio) this.publish({ ...this.snapshot, status: "idle" });
      });
      audio.addEventListener("error", () => {
        if (this.audio === audio) {
          this.publish({ ...this.snapshot, status: "error", error: "음성을 재생하지 못했어요." });
        }
      });
      if (playWhenReady) {
        await audio.play();
        this.publish({ playbackId: options.id, status: "playing", voice, rate, autoplay });
      } else {
        this.publish({ playbackId: options.id, status: "paused", voice, rate, autoplay });
      }
    } catch (error) {
      if (request.signal.aborted) return;
      this.releaseCurrent();
      this.publish({
        playbackId: options.id,
        status: "error",
        voice,
        rate,
        autoplay,
        error: error instanceof Error ? error.message : "음성을 재생하지 못했어요.",
      });
    }
  }

  stop() {
    this.releaseCurrent();
    this.publish(initialSnapshot);
  }
}

export const audioPlaybackController = new AudioPlaybackController();

export async function invalidateAudioCache(messageId: string, beforeRevision?: number) {
  const response = await fetch("/api/ai/speech", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, beforeRevision }),
  });
  if (!response.ok) throw new Error("음성 캐시를 갱신하지 못했어요.");
  return (await response.json()) as { invalidated: number };
}
