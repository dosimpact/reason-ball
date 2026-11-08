"""04 — 상태 기반 파일

쉽게 이해하기
-------------
StateBackend는 파일 내용을 그래프의 state 안에 보관하는 저장 방식이다.
예: /note.txt를 쓰고 수정하면 files 항목의 내용이 바뀐다.
OS 파일을 만드는 대신 agent의 파일 도구를 state 자료에 연결한다.

학습 목표: write/edit/read를 연결하고 files 상태에 남는 내용을 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/2-filesystem_and_backends/04_state_filesystem.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
상태 안의 가상 파일에 초안을 쓰고 내용을 수정한 뒤, 파일을 다시 읽어 변경 결과를 확인한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "/note.txt에 draft를 쓰고 final로 수정한 다음 읽어줘."
    }
  ]
}
```
관찰할 결과: /note.txt가 draft → final로 수정되고 read_file이 수정된 내용을 읽습니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "/note.txt에 draft를 쓰고 final로 수정한 다음 읽어줘."


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [call("write_file", file_path="/note.txt", content="draft")],
                [
                    call(
                        "edit_file",
                        file_path="/note.txt",
                        old_string="draft",
                        new_string="final",
                    )
                ],
                [call("read_file", file_path="/note.txt")],
            ]
        ),
        name="state_filesystem",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
