"use client";
import { BuiltinActionType, Renderer } from "@openuidev/react-lang";
import { library } from "./intelligent-ui/library";
import { runLibraryAction } from "./intelligent-ui/actions";
import { EvidenceView, type Evidence } from "./EvidenceView";

export function AnswerView({ program, evidence, onMessage, onError }: { program: string; evidence?: Evidence; onMessage?: (message: string) => void; onError?: () => void }) {
  return <div data-testid="intelligent-ui-answer"><Renderer response={program} library={library} isStreaming={false} onAction={(event) => {
    if (event.type === BuiltinActionType.ContinueConversation && event.humanFriendlyMessage) {
      const values = event.formState && Object.keys(event.formState).length ? `\n입력값: ${JSON.stringify(event.formState)}` : "";
      onMessage?.(`${event.humanFriendlyMessage}${values}`.slice(0, 4000));
    } else if (event.type === BuiltinActionType.OpenUrl) {
      const url = (event.params as { url?: string }).url;
      if (url && /^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
    } else void runLibraryAction(event);
  }} onError={(errors) => { if (errors.length) onError?.(); }} />{evidence && <EvidenceView evidence={evidence} />}</div>;
}
