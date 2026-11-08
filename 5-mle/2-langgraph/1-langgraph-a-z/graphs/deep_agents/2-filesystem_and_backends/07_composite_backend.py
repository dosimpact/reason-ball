"""07 — 경로별 Backend 분리

쉽게 이해하기
-------------
CompositeBackend는 파일 경로에 따라 사용할 저장소를 나누는 방식이다.
예: /memories/ 아래는 Store에, 나머지는 StateBackend에 보낸다.
같은 파일 도구를 쓰면서 작업용 자료와 기억용 자료의 저장 위치를 나눌 수 있다.

학습 목표: /memories/는 Store, 나머지는 StateBackend로 라우팅되는지 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/2-filesystem_and_backends/07_composite_backend.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
작업 파일은 StateBackend에, /memories/ 파일은 StoreBackend에 저장하고 기억 파일을 다시 읽는다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "/scratch.txt에 temporary, /memories/preference.txt에 Korean을 저장하고 읽어줘."
    }
  ]
}
```
관찰할 결과: files에는 /scratch.txt만 남고 /memories/preference.txt는 Store로 라우팅됩니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "/scratch.txt에 temporary, /memories/preference.txt에 Korean을 저장하고 읽어줘."


def build_graph(model=None, store=True):
    store = InMemoryStore() if store is True else store
    backend = CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": StoreBackend(namespace=lambda _rt: ("learner", "memory")),
        },
    )
    return create_deep_agent(
        model=model
        or create_model(
            [
                [call("write_file", file_path="/scratch.txt", content="temporary")],
                [
                    call(
                        "write_file",
                        file_path="/memories/preference.txt",
                        content="Korean",
                    )
                ],
                [call("read_file", file_path="/memories/preference.txt")],
            ]
        ),
        backend=backend,
        store=store,
        name="composite_backend",
    )


def studio_graph(config):
    """Store는 Agent Server에서 주입한다."""
    return build_graph(store=None)


graph = build_graph()

if __name__ == "__main__":
    result = run(graph, {"messages": [("user", PROMPT)]})
    print("state files에는 /scratch.txt만 남는지 확인:", list(result.get("files", {})))
