"use client";

import { Flag, X } from "lucide-react";
import { useState } from "react";

type CharacterReportProps = {
  characterId: string;
  characterName: string;
};

export function CharacterReport({ characterId, characterName }: CharacterReportProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("unsafe-language");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");

  async function submitReport() {
    setStatus("submitting");
    try {
      const payload = { characterId, reason, detail: detail.trim() };
      const mockMode = process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "mock" || process.env.NEXT_PUBLIC_DATA_PROVIDER !== "supabase";
      if (mockMode) {
        const previous = JSON.parse(localStorage.getItem("lingua-character-reports") ?? "[]") as unknown[];
        localStorage.setItem("lingua-character-reports", JSON.stringify([...previous, { ...payload, status: "queued-for-review" }]));
      } else {
        const response = await fetch(`/api/characters/${characterId}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: ({ "unsafe-language": "unsafe", privacy: "other", "not-learning-safe": "other", copyright: "copyright" } as Record<string, string>)[reason],
            details: detail.trim(),
          }),
        });
        if (!response.ok) throw new Error("report failed");
      }
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setStatus("idle"); }} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-5 py-3 text-sm font-bold" data-testid="report-character"><Flag className="size-4" /> 신고하기</button>
      {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={`${characterName} 신고`}><section className="w-full max-w-md rounded-[1.5rem] bg-white p-6 text-neutral-950 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-red-600">Safety report</p><h2 className="mt-2 text-2xl font-black">{characterName} 신고</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="신고 창 닫기" className="message-action"><X /></button></div>{status === "submitted" ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5" role="status"><p className="font-black text-emerald-800">검토 요청을 접수했어요.</p><p className="mt-2 text-sm leading-6 text-emerald-700">신고 내용이 검토 대기열에 등록됩니다. 운영자가 검토한 뒤 필요한 조치를 결정합니다.</p><button type="button" onClick={() => setOpen(false)} className="mt-5 rounded-full bg-neutral-950 px-5 py-2.5 text-xs font-black text-white">확인</button></div> : <div className="mt-6 space-y-4"><label className="block text-sm font-bold">신고 사유<select value={reason} onChange={(event) => setReason(event.target.value)} className="form-field"><option value="unsafe-language">유해하거나 차별적인 표현</option><option value="privacy">개인정보 요구</option><option value="not-learning-safe">학습에 부적합한 행동</option><option value="copyright">초상권·저작권 문제</option></select></label><label className="block text-sm font-bold">상세 내용<textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={4} className="form-field resize-none" placeholder="검토자가 확인할 내용을 적어 주세요." /></label>{status === "error" ? <p role="alert" className="text-sm font-bold text-red-600">접수하지 못했어요. 다시 시도해 주세요.</p> : null}<button type="button" onClick={() => void submitReport()} disabled={status === "submitting"} className="w-full rounded-full bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">{status === "submitting" ? "접수 중..." : "검토 요청 보내기"}</button></div>}</section></div> : null}
    </>
  );
}
