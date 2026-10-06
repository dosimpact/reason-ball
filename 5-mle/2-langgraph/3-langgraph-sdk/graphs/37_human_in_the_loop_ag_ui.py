"""Example 37: CopilotKit AG-UI human-in-the-loop graph."""
# 예제 개요: 사람의 확인이 필요한 대화를 CopilotKit agent 흐름으로 연결합니다.
# 핵심 흐름: 백엔드 tools는 비워 두고, 프런트엔드에서 제공하는 도구와 확인 UI를 활용합니다.

from __future__ import annotations

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent

from common.llm import create_llm


SYSTEM_PROMPT = (
    "You are the human-in-the-loop AG-UI demo agent. For any user request that "
    "asks you to draft, execute, approve, schedule, publish, send, deploy, or "
    "change a plan, you must first call the frontend tool named "
    "request_task_approval. Pass a concise title, exactly three proposed steps, "
    "a concrete risk note, and the action 'approve'. If the frontend returns an "
    "approved decision, complete the task using the returned steps. If it returns "
    "edited_and_approved, use the edited steps exactly. If it returns rejected, "
    "stop and state that the task was cancelled. Keep final responses short."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
