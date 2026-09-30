/** @jsxImportSource react */
"use client";

import { assistanceContentLanguages, type AssistanceResponse } from "@/entities/learning-assistance/model/assistance";
import { useUiMessages } from "@/shared/i18n/ui-messages-provider";

export function LearningHelpResult({ response, disabled, onUse }: {
  response: AssistanceResponse;
  disabled: boolean;
  onUse: (suggestion: string) => void;
}) {
  const { learningHelp: copy, languageTag } = useUiMessages();
  return <div className="mt-3 space-y-2" data-testid="learning-help-result">
    <p lang={assistanceContentLanguages.brief} className="font-bold">{response.result.brief}</p>
    <p lang={assistanceContentLanguages.suggestion} className="whitespace-pre-wrap break-words text-sm">{response.result.suggestion}</p>
    <details>
      <summary lang={languageTag} className="cursor-pointer underline">{copy.explanation}</summary>
      <p lang={assistanceContentLanguages.explanation} className="mt-2 whitespace-pre-wrap break-words">{response.result.explanation}</p>
    </details>
    <button lang={languageTag} type="button" disabled={disabled} onClick={() => onUse(response.result.suggestion)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white disabled:opacity-40">{copy.append}</button>
    <p lang={languageTag} className="text-neutral-500">{response.source === "mock" ? copy.demo : copy.generated} · {copy.persistenceNotice}</p>
  </div>;
}
