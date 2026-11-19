"use client";

import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { financialSnapshotSchema, type FinancialSnapshot } from "./financial-schema";
import { loadingSnapshot } from "./financial-visibility";

export function FinancialChartMetadataView({ snapshot: value }: { snapshot?: FinancialSnapshot | null }) {
  const snapshot = value ?? loadingSnapshot;
  return <details className="iui-financial-metadata">
    <summary>데이터 출처와 분석 기준</summary>
    <dl>
      <dt>출처</dt><dd>{snapshot.source_url ? <a href={snapshot.source_url} target="_blank" rel="noreferrer">{snapshot.source ?? "원본 데이터"}</a> : snapshot.source ?? "—"}</dd>
      <dt>분석 기준일</dt><dd>{snapshot.as_of ?? "—"}</dd>
      <dt>조회 시각</dt><dd>{snapshot.fetched_at ?? "—"}</dd>
      <dt>가격 기준</dt><dd>{snapshot.auto_adjust ? "수정주가" : "제공된 가격"}</dd>
      {snapshot.schemaVersion === 2 && <><dt>지표 카탈로그</dt><dd>{snapshot.catalogVersion}</dd>
        {snapshot.origin && <><dt>누적 기준 시작일</dt><dd>{snapshot.origin.date ?? "알 수 없음"}</dd><dt>사용 이력</dt><dd>{snapshot.origin.availableHistory}봉</dd><dt>누적 기준 정책</dt><dd>{snapshot.origin.policy}</dd></>}
      </>}
    </dl>
    <p>분석 본문은 답변 시점의 스냅샷입니다. 차트 조회 조건을 바꾸어도 기존 분석 내용은 유지됩니다.</p>
  </details>;
}

export const FinancialChartMetadata = defineComponent({
  name: "FinancialChartMetadata", props: z.object({ snapshot: financialSnapshotSchema }),
  description: "Collapsed financial data provenance, dates, adjusted-price basis and accumulation policy in readable labels, without raw JSON.",
  component: ({ props }) => <FinancialChartMetadataView snapshot={props.snapshot} />,
});
