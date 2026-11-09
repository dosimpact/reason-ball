"use client";
import { BuiltinActionType, Renderer, type ActionEvent } from "@openuidev/react-lang";
import { library } from "./library";
import { BusinessAction, runLibraryAction } from "./actions";

export type BusinessRequest = { name: string; context: Record<string, unknown> };

export function OutputView({ program, busy = false, onMessage, onBusinessAction, onError }: {
  program: string;
  busy?: boolean;
  onMessage?: (message: string) => void;
  onBusinessAction?: (action: BusinessRequest) => void;
  onError?: () => void;
}) {
  function handleAction(event: ActionEvent) {
    if (busy) return;
    if (event.type === BusinessAction.name) {
      const parsed = event.params as Partial<BusinessRequest>;
      if (typeof parsed.name === "string" && parsed.context && typeof parsed.context === "object" && !Array.isArray(parsed.context)) {
        onBusinessAction?.({ name: parsed.name, context: parsed.context });
      }
    } else if (event.type === BuiltinActionType.ContinueConversation && event.humanFriendlyMessage) {
      const values = event.formState && Object.keys(event.formState).length ? `\n입력값: ${JSON.stringify(event.formState)}` : "";
      onMessage?.(`${event.humanFriendlyMessage}${values}`.slice(0, 4000));
    } else if (event.type === BuiltinActionType.OpenUrl) {
      const url = (event.params as { url?: string }).url;
      if (url && /^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
    } else void runLibraryAction(event);
  }
  return <Renderer response={program} library={library} isStreaming={busy} onAction={handleAction} onError={errors => { if (errors.length) onError?.(); }} />;
}
