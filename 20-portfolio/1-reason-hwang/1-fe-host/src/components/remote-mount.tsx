"use client";

import { useEffect, useRef, useState } from "react";

import { loadRemoteMount } from "@/lib/module-federation";
import { getRemoteConfig, type RemoteName } from "@/lib/remotes";

type LoadState = "idle" | "loading" | "ready" | "error";

export function RemoteMount({ name }: { name: RemoteName }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const container = containerRef.current;
    let cancelled = false;

    async function mountRemote() {
      if (!container) {
        return;
      }

      setState("loading");
      setMessage("");

      try {
        cleanupRef.current?.();
        cleanupRef.current = null;
        container.replaceChildren();

        const mount = await loadRemoteMount(name);

        if (cancelled) {
          return;
        }

        cleanupRef.current = mount(container);
        setState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Remote failed to load from the BFF.",
        );
      }
    }

    void mountRemote();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      container?.replaceChildren();
    };
  }, [name]);

  const remote = getRemoteConfig(name);

  return (
    <section className="min-h-0 flex-1 rounded-md border bg-white">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {remote.label}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {remote.entry}
          </p>
        </div>
        <div className="shrink-0 rounded-sm border px-2 py-1 text-xs font-medium text-muted-foreground">
          {state}
        </div>
      </div>

      {state === "error" ? (
        <div className="p-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {message}
          </div>
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="p-4 text-sm text-muted-foreground">
          Loading remote through BFF...
        </div>
      ) : null}

      <div ref={containerRef} className="min-h-[420px] p-4" />
    </section>
  );
}
