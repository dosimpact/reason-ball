"""05 — 디스크 Backend

쉽게 이해하기
-------------
FilesystemBackend는 agent의 파일 도구를 실제 디스크 폴더에 연결한다.
예: write_file로 쓴 내용을 Python의 파일 읽기로도 확인한다.
이 예제는 실행마다 새 임시 폴더를 만들고 종료할 때 정리한다.

학습 목표: 상태 파일과 실제 디스크 파일의 차이. 실행마다 새 디렉터리를 써 재실행 가능.
실행: uv run --extra deep-agents python graphs/deep_agents/2-filesystem_and_backends/05_disk_backend.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
FilesystemBackend에 연결한 디스크 폴더에 파일을 쓰고 읽어, 실제 파일 저장 결과를 확인한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "/note.txt에 disk-demo를 저장하고 읽어줘."
    }
  ]
}
```
관찰할 결과: FilesystemBackend의 실제 note.txt를 확인합니다. main의 임시 디렉터리는 프로세스 종료 시 제거됩니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "/note.txt에 disk-demo를 저장하고 읽어줘."
_workspace = TemporaryDirectory(prefix="deep-agents-disk-")


def build_graph(model=None, root=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [call("write_file", file_path="/note.txt", content="disk-demo")],
                [call("read_file", file_path="/note.txt")],
            ]
        ),
        backend=FilesystemBackend(root_dir=root or _workspace.name, virtual_mode=True),
        name="disk_backend",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
    print("디스크 실제 내용:", (Path(_workspace.name) / "note.txt").read_text())
    print("임시 작업 공간은 프로세스 종료 시 제거됩니다.")
