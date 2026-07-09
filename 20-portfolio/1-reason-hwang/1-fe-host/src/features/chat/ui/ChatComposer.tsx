"use client";

import { FormEvent, useState } from "react";
import { RotateCcw, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatStatus } from "@/features/chat/model/chatTypes";

type ChatComposerProps = {
  status: ChatStatus;
  onReset: () => void;
  onSendMessage: (content: string) => Promise<void>;
};

export function ChatComposer({
  status,
  onReset,
  onSendMessage,
}: ChatComposerProps) {
  const [content, setContent] = useState("");
  const isBusy = status === "creating_thread" || status === "streaming";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim() || isBusy) {
      return;
    }

    const submittedContent = content;
    setContent("");
    await onSendMessage(submittedContent);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <Textarea
        aria-label="Message"
        className="min-h-24 text-sm"
        disabled={isBusy}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Ask the starter graph about weather or anything it can answer."
        value={content}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={isBusy}
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
        <Button type="submit" disabled={isBusy || !content.trim()}>
          <SendHorizontal data-icon="inline-start" />
          Send
        </Button>
      </div>
    </form>
  );
}
