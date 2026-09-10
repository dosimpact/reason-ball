'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { unknownModelCapabilities, type ChatModelEntry } from '@/shared/api/ai/model-catalog';

type Props = {
  entries: ChatModelEntry[];
  model: string;
  disabled: boolean;
  loading: boolean;
  failed: boolean;
  onChange: (id: string) => void;
  onRetry: () => void;
};

const labels = { vision: '이미지', documents: 'PDF', tools: '도구', reasoning: '추론' } as const;

export function ChatModelSelector({ entries, model, disabled, loading, failed, onChange, onRetry }: Props) {
  const [search, setSearch] = useState('');
  const matches = entries.filter(({ id }) => id.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = !failed && !loading ? entries.find(({ id }) => id === model) : undefined;
  const capabilities = selected?.capabilities ?? unknownModelCapabilities;

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-black/6 px-4 py-2 sm:px-6">
      <input aria-label="AI 모델 검색" placeholder="모델 검색" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 rounded-lg border border-black/10 px-2 py-1 text-xs" />
      <label className="relative min-w-0">
        <span className="sr-only">AI 모델 선택</span>
        <select disabled={disabled || loading || failed} value={model} onChange={(event) => onChange(event.target.value)} aria-describedby="chat-model-capabilities" className="h-9 w-full appearance-none rounded-full border border-black/8 bg-white pl-3 pr-8 text-[11px] font-bold outline-none">
          {!matches.some(({ id }) => id === model) ? <option value={model}>{model} (현재 선택)</option> : null}
          {matches.map(({ id }) => <option key={id} value={id}>{id}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2" />
      </label>
      <div id="chat-model-capabilities" aria-label="선택 모델 기능" aria-live="polite" className="col-span-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-600">
        {Object.entries(labels).map(([key, label]) => {
          const value = capabilities[key as keyof typeof labels];
          return <span key={key}>{label}: {value === true ? '지원' : value === false ? '미지원' : '미확인'}</span>;
        })}
        <span className="w-full text-neutral-400">{selected?.capabilitySource === 'mock' ? '모의 공급자 기능 · 실제 모델 지원 정보가 아닙니다.' : selected?.capabilitySource === 'configured' ? '배포 설정 기준 · 추론 내용은 공급자가 제공할 때 표시합니다.' : '기능 확인 전에는 이미지·PDF·도구를 사용할 수 없어요.'}</span>
      </div>
      {failed ? <button type="button" onClick={onRetry} className="col-span-2 text-left text-xs text-red-700">모델 목록 다시 불러오기</button> : !loading && matches.length === 0 ? <span role="status" className="col-span-2 text-xs">선택 가능한 검색 결과가 없어요.</span> : null}
    </div>
  );
}
