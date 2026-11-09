"use client";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { EvidenceView, type Evidence } from "./EvidenceView";

export function AnswerView({ program, evidence, onMessage, onError }: { program: string; evidence?: Evidence; onMessage?: (message: string) => void; onError?: () => void }) {
  return <div data-testid="intelligent-ui-answer"><OutputView program={program} onMessage={onMessage} onError={onError} />{evidence && <EvidenceView evidence={evidence} />}</div>;
}
