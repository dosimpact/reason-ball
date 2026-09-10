"use client";

import Link from "next/link";
import { useOwnedCreations } from "@/entities/creator-content/api/use-creations";
import { canEditCreation, creationStatusLabels } from "@/entities/creator-content/model/creations";

export function CreatorLibrary() {
  const query = useOwnedCreations();
  if (query.isError) return <section role="alert" className="mt-8 rounded-xl border p-6"><p>내 생성물을 불러오지 못했어요. 빈 목록으로 바꾸지 않았습니다.</p><button className="mt-3 underline" onClick={() => void query.refetch()}>내 생성물 다시 불러오기</button></section>;
  if (!query.data) return <p role="status" className="mt-8">내 생성물을 불러오고 있어요.</p>;
  const creations = query.data;
  return <section className="mt-8 space-y-6" data-testid="profile-creations">
    <h2 className="text-2xl font-black">내가 만든 학습 콘텐츠</h2>
    <p className="text-sm text-neutral-500">{query.data.source === "browser" ? "이 브라우저에서 만든 데모 콘텐츠입니다. 원격 계정 소유권을 뜻하지 않습니다." : "로그인한 계정이 소유한 콘텐츠입니다."}</p>
    {(["character", "mission"] as const).map((kind) => {
      const items = creations.items.filter((item) => item.kind === kind);
      const label = kind === "character" ? "캐릭터" : "미션";
      const path = kind === "character" ? "characters" : "missions";
      return <div key={kind} className="space-y-4"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{label}</h3><Link href={`/${path}/new`} className="text-sm underline">새 {label} 만들기</Link></div>
        {!items.length ? <p className="rounded-xl border border-dashed p-6">아직 만든 {label} 콘텐츠가 없어요.</p> : null}
        <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item.id} data-testid={`profile-created-${kind}-${item.id}`} className="rounded-2xl border bg-white p-5">
          <span className="text-xs font-bold text-indigo-700">{creationStatusLabels[item.status]}</span><h4 className="mt-3 font-black">{item.title}</h4><p className="mt-2 text-sm text-neutral-500">{item.summary}</p>
          {canEditCreation(item) || item.status === "archived" ? <Link href={`/${path}/${encodeURIComponent(item.id)}/edit`} className="mt-4 inline-block text-sm underline">{item.status === "archived" ? "보관된 내용 확인" : kind === "mission" ? "미션 편집하기" : "캐릭터 편집하기"}</Link> : <p className="mt-4 text-sm text-neutral-500">처리 완료 후 편집할 수 있어요.</p>}
        </article>)}</div>
      </div>;
    })}
  </section>;
}
