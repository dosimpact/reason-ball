"""Example 41: predictive document state updates with AG-UI.

쉽게 이해하기
-------------
Predictive update는 작업 중 예상 변경을 먼저 표시하고 확정 결과와 맞추는 방식이다.
예: 문서 수정 중의 미리보기와 완료된 문서를 비교한다.
이 파일은 수정 패치와 revision 설명을 반환하고 화면 도구가 상태를 반영한다.

그래프 구조
-----------
문서 편집 요청의 패치와 revision 설명을 만들고, 프런트엔드 도구로 문서 상태에 반영하도록 전달한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Shorten the current document body."
    }
  ]
}
```
관찰할 결과: edit_document → apply_document_update 프런트 도구를 통한 예측 상태와 서버 결과의 일치를 확인합니다. 현재 document는 React context로 제공합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.

UI 협력 실습
-------------
Predict shorten·Confirm은 로컬 상태를 변경합니다. 채팅의 edit_document → apply_document_update는 별도 에이전트 경로입니다. Confirm은 서버 승인이 아닙니다. reverted는 직전 snapshot 대신 초기 문서로 돌아갑니다.
전체 실습: docs/stock/ui-learning-system.md (프로젝트 루트 기준).
"""
# 예제 개요: 문서의 예상 변경과 확정 결과를 맞추는 predictive state 예제입니다.
# 핵심 흐름: 백엔드가 수정 패치와 revision 설명을 반환하고, 프런트엔드 도구가 화면 상태를 반영합니다.

from __future__ import annotations

from typing import Any, Literal

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


Operation = Literal["rewrite_title", "improve_paragraph", "shorten", "append_summary"]


def _shorten(text: str) -> str:
    sentences = [part.strip() for part in text.replace("\n", " ").split(".") if part.strip()]
    if len(sentences) <= 2:
        return text.strip()
    return ". ".join(sentences[:2]) + "."


@tool("edit_document")
def edit_document(title: str, body: str, operation: Operation) -> dict[str, Any]:
    """Return a deterministic document patch for predictive state reconciliation."""
    clean_title = title.strip() or "Untitled launch note"
    clean_body = body.strip() or "Draft body."

    if operation == "rewrite_title":
        patch = {"title": f"{clean_title}: reviewed draft"}
        summary = "Rewrote the title while preserving the body."
    elif operation == "shorten":
        patch = {"body": _shorten(clean_body)}
        summary = "Shortened the body to the first two complete sentences."
    elif operation == "append_summary":
        patch = {"body": f"{clean_body}\n\nSummary: Keep the launch note focused, testable, and ready for review."}
        summary = "Appended a concise summary paragraph."
    else:
        patch = {
            "body": (
                clean_body
                + "\n\nRevision note: Clarified the outcome, owner, and next decision point."
            )
        }
        summary = "Improved the paragraph with a deterministic revision note."

    return {
        "operation": operation,
        "patch": patch,
        "summary": summary,
        "confirmation": "Use the frontend apply_document_update tool to reconcile this patch into visible state.",
    }


@tool("explain_revision")
def explain_revision(revision: int, last_operation: str) -> dict[str, Any]:
    """Explain the current document revision status."""
    return {
        "revision": revision,
        "last_operation": last_operation or "none",
        "status": "confirmed",
    }


SYSTEM_PROMPT = (
    "You are a document editing copilot for an AG-UI predictive state demo. "
    "React provides current document state in context. Use edit_document for deterministic "
    "patches. After choosing a patch, call the frontend apply_document_update tool so the "
    "browser can reconcile pending optimistic state with backend-confirmed state. Do not "
    "invent hidden edits; describe the visible revision number and operation."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm("luna"),
        tools=[edit_document, explain_revision],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
