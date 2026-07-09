"use client";

import { AlertCircle, CircleCheck, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ChatStatus } from "@/features/chat/model/chatTypes";

type ChatStatusBarProps = {
  error: string | null;
  status: ChatStatus;
};

export function ChatStatusBar({ error, status }: ChatStatusBarProps) {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle data-icon="inline-start" />
        {error}
      </div>
    );
  }

  if (status === "creating_thread" || status === "streaming") {
    return (
      <Badge variant="secondary" className="w-fit">
        <Loader2 className="animate-spin" data-icon="inline-start" />
        {status === "creating_thread" ? "Creating thread" : "Streaming"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="w-fit">
      <CircleCheck data-icon="inline-start" />
      Ready
    </Badge>
  );
}
