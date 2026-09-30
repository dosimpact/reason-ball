"use client";

import type { ReactNode } from "react";
import { useOwnedCreations } from "../api/use-creations";
import { creationStatusLabels } from "../model/creations";

export function CreationAccessGate({ kind, id, children }: { kind: "character" | "mission"; id: string; children: ReactNode }) {
  const query = useOwnedCreations();
  const owned = query.data?.items.find((item) => item.kind === kind && item.id === id);
  if (query.isError && !owned) return <section role="alert" className="mx-auto max-w-3xl p-10"><p>편집 권한을 확인하지 못했어요. 다른 사람의 콘텐츠라고 판단한 것은 아닙니다.</p><button className="mt-3 underline" onClick={() => void query.refetch()}>생성물 권한 다시 확인</button></section>;
  if (query.isPending || (!owned && query.isFetching)) return <p role="status" className="p-10">생성물 소유권을 확인하고 있어요.</p>;
  if (!owned) return <section className="p-10"><h1 className="text-2xl font-bold">편집할 수 없는 콘텐츠예요.</h1><p className="mt-3">내가 만든 콘텐츠만 편집할 수 있어요.</p></section>;
  if (owned.status === "generating" || owned.status === "review") return <section className="p-10"><h1 className="text-2xl font-bold">{creationStatusLabels[owned.status]} 콘텐츠입니다.</h1><p className="mt-3">진행 중인 처리가 끝난 뒤 다시 열어 주세요.</p></section>;
  return <>{query.isError ? <p role="alert" className="p-3">소유권 새로고침에 실패했습니다. 편집 내용은 유지했으며 저장 시 서버에서 권한을 다시 확인합니다.</p> : null}{children}</>;
}
