import { expect, it } from "vitest";
import type { ToolActivity } from "@openuidev/react-headless";
import { toolStatus } from "./tool-status";

const activity = (values: Record<string, unknown>) =>
  ({
    id: "call",
    toolName: "read_document_page",
    input: { document_id: "amd", page: 55 },
    status: "complete",
    isError: false,
    result: "{}",
    ...values,
  }) as ToolActivity;

it("does not confuse a returned failure with successful work", () => {
  expect(
    toolStatus(
      activity({ result: '{"success":false,"error":"No evidence"}' }),
      false,
    ).status,
  ).toBe("실패");
  expect(
    toolStatus(activity({ result: '{"failed":2,"completed":3}' }), false)
      .status,
  ).toBe("일부 실패");
  expect(toolStatus(activity({ result: "plain response" }), false).status).toBe(
    "응답 수신",
  );
});
it("distinguishes live calls from incomplete stopped calls and shows document scope", () => {
  const pending = activity({ status: "executing", result: undefined });
  expect(toolStatus(pending, true)).toMatchObject({
    label: "원문 페이지 확인",
    scope: "amd · 55페이지",
    status: "진행 중",
  });
  expect(toolStatus(pending, false).status).toBe("미완료");
  expect(toolStatus(activity({ isError: true }), true).status).toBe("실패");
});
