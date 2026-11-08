"""06 — thread 간 파일 공유

쉽게 이해하기
-------------
StoreBackend는 파일을 여러 thread에서 참고할 수 있는 Store에 보관한다.
예: 첫 대화에서 저장한 선호를 다른 대화에서도 읽는다.
namespace는 자료를 구분하는 묶음 이름이고, 여기의 InMemoryStore는 프로세스 안에서 유지된다.

학습 목표: StoreBackend의 namespace와 thread checkpoint의 차이. 메모리 Store는 재시작 시 소실.
실행: uv run --extra deep-agents python graphs/deep_agents/2-filesystem_and_backends/06_store_backend.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
StoreBackend의 같은 namespace에서 파일을 읽어, thread가 달라도 저장 자료를 공유하는 흐름을 보여준다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "/profile.txt를 읽어줘."
    }
  ]
}
```
관찰할 결과: 서로 다른 thread에서 같은 namespace의 /profile.txt를 읽습니다. InMemoryStore는 프로세스 재시작 시 소실됩니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
CLI graph는 fixture Store와 config의 thread_id가 필요합니다. Studio 등록은 studio_graph factory로 platform Store/checkpointer를 사용하며 fixture를 먼저 씁니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from deepagents.backends import StoreBackend
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "/profile.txt를 읽어줘."


def build_graph(model=None, store=True, namespace="learner", checkpointer=True):
    store = InMemoryStore() if store is True else store
    return create_deep_agent(
        model=model or create_model([[call("read_file", file_path="/profile.txt")]]),
        backend=StoreBackend(namespace=lambda _rt: (namespace, "files")),
        store=store,
        checkpointer=InMemorySaver() if checkpointer is True else checkpointer,
        name="store_backend",
    )


store = InMemoryStore()
backend = StoreBackend(store=store, namespace=lambda _rt: ("learner", "files"))
# 학습 fixture를 seed한다. 이전 예제를 실행할 필요가 없다.
backend.write("/profile.txt", "선호 언어: 한국어")


def studio_graph(config):
    """서버 Store를 사용한다. 첫 tool로 fixture를 쓰고 다음 tool로 읽는다."""
    model = create_model(
        [
            [call("write_file", file_path="/profile.txt", content="선호 언어: 한국어")],
            [call("read_file", file_path="/profile.txt")],
        ]
    )
    return build_graph(model=model, store=None, checkpointer=None)


graph = build_graph(store=store)

if __name__ == "__main__":
    for thread in ("thread-a", "thread-b"):
        print(thread)
        run(
            graph,
            {"messages": [("user", PROMPT)]},
            {"configurable": {"thread_id": thread}, "recursion_limit": 60},
        )
