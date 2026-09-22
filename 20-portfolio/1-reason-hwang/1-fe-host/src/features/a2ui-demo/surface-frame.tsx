import type { ReactNode } from "react";

export function SurfaceFrame({ historical, canvas, title, children }: { historical: boolean; canvas: boolean; title: string; children: ReactNode }) {
  if (historical) return <details className="my-3 rounded-xl border bg-muted/20 p-3">
    <summary className="cursor-pointer text-sm font-medium">이전 결과 · {title}<span className="ml-2 text-xs text-muted-foreground">읽기 전용</span></summary>
    <div className="mt-4">{children}</div>
  </details>;
  return <div className="min-w-0"><p className="mb-3 text-xs font-medium text-muted-foreground">{canvas ? "작업 화면" : "대화 결과"} · {title}</p>{children}</div>;
}
