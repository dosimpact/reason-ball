"""Example 37: CopilotKit AG-UI human-in-the-loop graph.

쉽게 이해하기
-------------
사람 확인 UI는 agent가 요청한 작업을 사람이 결정하도록 하는 화면이다.
예: 화면에서 승인 여부를 선택하고 agent 작업을 이어 간다.
이 예제는 프런트엔드가 제공하는 도구와 확인 UI를 사용한다.

그래프 구조
-----------
화면에서 제공하는 도구와 확인 UI를 이용해 사람의 결정을 받고, 그 결과를 반영해 대화를 이어간다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Draft a three-step plan for reviewing a release note."
    }
  ]
}
```
관찰할 결과: request_task_approval 프런트 도구의 세 단계와 승인/수정/거절 응답에 따른 후속 메시지를 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
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
