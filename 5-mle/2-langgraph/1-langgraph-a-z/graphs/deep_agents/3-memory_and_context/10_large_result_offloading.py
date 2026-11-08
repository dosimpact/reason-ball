"""10 — 큰 도구 결과 오프로딩

쉽게 이해하기
-------------
Offloading은 긴 도구 결과를 파일에 두고 대화에는 짧은 참조를 남기는 방법이다.
예: 큰 JSON을 저장하고 필요한 부분만 read_file로 다시 읽는다.
원문은 보존하면서 모델에게 매번 전달할 내용을 줄인다.

학습 목표: FilesystemMiddleware의 임계값을 낮춰 원문 파일 저장과 참조 메시지 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/3-memory_and_context/10_large_result_offloading.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
긴 도구 결과를 파일로 옮기고, 짧은 참조를 받은 모델이 필요한 부분을 다시 읽는다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "load_records로 연습 데이터를 불러오고, 오프로딩된 원문 파일의 앞부분을 읽어줘."
    }
  ]
}
```
관찰할 결과: load_records의 큰 JSON이 /large_tool_results/에 보관되고 모델은 참조를 받아 앞부분만 재조회합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

import json

from deepagents import create_deep_agent
from deepagents.middleware.filesystem import FilesystemMiddleware
from langchain_core.tools import tool

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "load_records로 연습 데이터를 불러오고, 오프로딩된 원문 파일의 앞부분을 읽어줘."


@tool
def load_records() -> str:
    """연습용 JSON 200행을 반환한다. 실제 네트워크 호출은 없다."""
    return json.dumps(
        [{"id": i, "amount": i * 3, "note": "sample " * 20} for i in range(200)],
        indent=2,
    )


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [call("load_records")],
                [
                    call(
                        "read_file",
                        file_path="/large_tool_results/call-0-0",
                        offset=0,
                        limit=6,
                    )
                ],
            ]
        ),
        tools=[load_records],
        middleware=[FilesystemMiddleware(tool_token_limit_before_evict=300)],
        name="large_result_offloading",
    )


graph = build_graph()

if __name__ == "__main__":
    result = run(graph, {"messages": [("user", PROMPT)]})
    print("원문 파일 크기:", {k: len(str(v)) for k, v in result.get("files", {}).items()})
