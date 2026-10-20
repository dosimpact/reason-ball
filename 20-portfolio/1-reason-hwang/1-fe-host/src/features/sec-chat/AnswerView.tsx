"use client";
import { Renderer } from "@openuidev/react-lang";
import { library } from "./intelligent-ui/library";
import { runLibraryAction } from "./intelligent-ui/actions";

export function AnswerView({ program, onError }: { program: string; onError?: () => void }) {
  return <div data-testid="intelligent-ui-answer"><Renderer response={program} library={library} isStreaming={false} onAction={(event) => { void runLibraryAction(event); }} onError={(errors) => { if (errors.length) onError?.(); }} /></div>;
}
