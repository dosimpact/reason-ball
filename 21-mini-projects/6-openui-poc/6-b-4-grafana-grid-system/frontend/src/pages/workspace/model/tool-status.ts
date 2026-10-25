import type { ToolActivity } from "@openuidev/react-headless";

const labels: Record<string, string> = {
  search_documents: "보고서 검색",
  read_document_page: "원문 페이지 확인",
  find_sec_company: "기업 확인",
  list_sec_reports: "준비된 보고서 확인",
  collect_sec_reports: "SEC 보고서 수집",
  search_sec_reports: "SEC 원문 검색",
  read_sec_section: "보고서 섹션 확인",
  get_sec_financials: "재무 데이터 조회",
  find_document_pages: "원문 페이지 찾기",
  inspect_dashboard: "Canvas 상태 확인",
  publish_ui_panel: "분석 결과 저장",
  publish_financial_chart: "재무 차트 생성",
  modify_dashboard: "Canvas 변경",
  pin_canvas_panel: "패널 고정 변경",
  refresh_canvas_panel: "패널 데이터 갱신",
  add_artifact_to_canvas: "Canvas에 결과 추가",
  task: "하위 에이전트 작업",
};

export function toolStatus(activity: ToolActivity, running: boolean) {
  let failed = activity.isError;
  let partial = false;
  if (activity.result) {
    try {
      const result = JSON.parse(activity.result);
      failed ||=
        result?.success === false ||
        Boolean(result?.error) ||
        result?.status === "failed";
      partial = typeof result?.failed === "number" && result.failed > 0;
    } catch {
      /* A plain-text tool response is not necessarily an error. */
    }
  }
  const pending =
    activity.status === "streaming" || activity.status === "executing";
  const status = failed
    ? "실패"
    : partial
      ? "일부 실패"
      : pending
        ? running
          ? "진행 중"
          : "미완료"
        : "응답 수신";
  const input = activity.input as Record<string, unknown> | undefined;
  const scope = [
    typeof input?.document_id === "string" ? input.document_id : "",
    typeof input?.page === "number" ? `${input.page}페이지` : "",
    typeof input?.section === "string" ? input.section : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    label: labels[activity.toolName] ?? "분석 작업",
    status,
    scope,
    failed: failed || partial,
  };
}
