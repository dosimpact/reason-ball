import { FileText, ImageIcon } from "lucide-react";
import type { ChatMessage, WeatherData } from "../model/types";
import { chatFileDisplayUrl } from '../model/attachment';
import { RichText } from './rich-text';

type MessageContentProps = {
  message: ChatMessage;
  allowPrivateFiles?: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  onWeatherDecision?: (approved: boolean, partIndex: number) => void;
};


function WeatherCard({ data, onDecision, partIndex }: { data: WeatherData; onDecision?: (approved: boolean, partIndex: number) => void; partIndex: number }) {
  return <section className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-950" aria-label={`${data.location} 날씨 도구`} data-testid="weather-tool-card"><p className="text-[10px] font-black uppercase tracking-wider text-sky-600">Weather tool</p><p className="mt-1 font-bold">{data.location} 날씨 조회</p>{data.state === "approval-requested" ? <div className="mt-3 flex gap-2"><button type="button" onClick={() => onDecision?.(true, partIndex)} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white">허용</button><button type="button" onClick={() => onDecision?.(false, partIndex)} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold">거부</button></div> : null}{data.state === "result" ? <p className="mt-2 text-sm"><strong>{data.temperature}°C</strong> · {data.condition}</p> : null}{data.state === "denied" ? <p className="mt-2 text-xs">사용자가 날씨 조회를 거부했어요.</p> : null}</section>;
}

function ToolWeatherCard({ part, onApproval }: {
  part: Extract<ChatMessage["parts"][number], { type: "tool-weather" }>;
  onApproval?: (approvalId: string, approved: boolean) => void;
}) {
  const location = part.input?.location ?? "선택한 지역";
  return <section className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-950" aria-label={`${location} 날씨 도구`} data-testid="weather-tool-card"><p className="text-[10px] font-black uppercase tracking-wider text-sky-600">Weather tool · AI SDK</p><p className="mt-1 font-bold">{location} 날씨 조회</p>{part.state === "approval-requested" ? <div className="mt-3 flex gap-2"><button type="button" onClick={() => onApproval?.(part.approval.id, true)} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white">허용</button><button type="button" onClick={() => onApproval?.(part.approval.id, false)} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold">거부</button></div> : null}{part.state === "output-available" && part.output ? <p className="mt-2 text-sm"><strong>{part.output.temperature}°C</strong> · {part.output.condition}<span className="ml-2 text-[10px] text-sky-600">{part.output.source}</span></p> : null}{part.state === "output-denied" || (part.state === "approval-responded" && !part.approval.approved) ? <p className="mt-2 text-xs">사용자가 날씨 조회를 거부했어요.</p> : null}{part.state === "output-error" ? <p className="mt-2 text-xs text-red-700">{part.errorText}</p> : null}{part.state === "input-streaming" || part.state === "input-available" || (part.state === "approval-responded" && part.approval.approved) ? <p className="mt-2 text-xs text-sky-700">날씨 도구를 준비하고 있어요…</p> : null}</section>;
}

export function messageText(message: ChatMessage) {
  return message.parts.filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text").map((part) => part.text).join("");
}

export function MessageContent({ message, allowPrivateFiles = true, onToolApproval, onWeatherDecision }: MessageContentProps) {
  return <div className="space-y-2">{message.parts.map((part, index) => {
    if (part.type === "text") return <RichText key={index} text={part.text} />;
    if (part.type === "file") {
      if (!allowPrivateFiles && part.url.startsWith('chat-file:')) return <p key={index} data-testid="private-attachment-notice" className="text-xs">비공개 첨부파일 · 소유자만 열 수 있어요.</p>;
      const image = part.mediaType.startsWith("image/");
      const url = chatFileDisplayUrl(part.url);
      return <div key={index} className="overflow-hidden rounded-xl border border-black/10 bg-white/80" data-testid="message-attachment">{image ? <img src={url} alt={part.filename ?? "첨부 이미지"} className="max-h-52 w-full object-cover" /> : <div className="flex items-center gap-2 p-3 text-xs text-neutral-700"><FileText className="size-4" /> {part.filename ?? "첨부 문서"}</div>}<p className="flex items-center gap-1 border-t border-black/5 px-3 py-2 text-[10px] text-neutral-500">{image ? <ImageIcon className="size-3" /> : null}{part.filename}{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto underline" aria-label={`${part.filename ?? '첨부 파일'} 열기`}>열기</a> : <span>파일을 열 수 없어요.</span>}</p></div>;
    }
    if (part.type === "data-weather") return <WeatherCard key={index} data={part.data} onDecision={onWeatherDecision} partIndex={index} />;
    if (part.type === "tool-weather") return <ToolWeatherCard key={index} part={part} onApproval={onToolApproval} />;
    return null;
  })}</div>;
}
