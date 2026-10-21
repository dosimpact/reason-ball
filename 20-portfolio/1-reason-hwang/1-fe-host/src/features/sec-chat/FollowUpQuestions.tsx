"use client";

export function FollowUpQuestions({ questions, disabled, onSelect }: { questions: string[]; disabled: boolean; onSelect: (question: string) => void }) {
  if (!questions.length) return null;
  return <nav className="sec-follow-ups" aria-label="다음 추천 질문"><p>이어서 물어보세요</p>{questions.map(question => <button type="button" key={question} disabled={disabled} onClick={() => onSelect(question)}>{question}<span aria-hidden="true">↗</span></button>)}</nav>;
}
