"""08 — Memory 지침 로딩

쉽게 이해하기
-------------
Memory 지침은 모델이 작업할 때 참고하도록 파일에 적어 둔 안내다.
예: 한국어로 답하라는 지침을 모델의 system context에 함께 넣는다.
이 예제는 /AGENTS.md의 내용이 첫 호출부터 전달되는지 확인한다.

학습 목표: memory 파일이 모델의 system context에 주입되는지 확인. 자동 학습 성공과 구분.
실행: uv run --extra deep-agents python graphs/deep_agents/3-memory_and_context/08_memory_instructions.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
/AGENTS.md의 지침을 모델의 system context에 주입하고, 해당 지침을 참고해 응답한다.

테스트 입력 예시
----------------
관찰할 결과: 첫 모델 system context에 /AGENTS.md의 MEMORY_KO 지침이 주입되는지 확인합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
입력(Python): sample_input()을 graph.invoke에 전달합니다. 이 함수가 해당 예제의 지침/skill 파일 또는 긴 대화를 함께 준비합니다.
Studio 입력 JSON 출력: uv run --extra deep-agents python -m scripts.deep_agents.example_input 8
"""

from __future__ import annotations

from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data

from common.deep_agents.demo import run
from common.deep_agents.model import ROOT, create_model

PROMPT = "기억된 지침을 적용해 간단히 인사해줘."


def sample_input():
    return {
        "messages": [("user", PROMPT)],
        "files": {
            "/AGENTS.md": create_file_data((ROOT / "assets/deep_agents/memory.md").read_text()),
        },
    }


def build_graph(model=None):
    return create_deep_agent(
        model=model or create_model(answer="MEMORY_KO: 안녕하세요."),
        memory=["/AGENTS.md"],
        name="memory_instructions",
    )


graph = build_graph()

if __name__ == "__main__":
    model = create_model(answer="지침 로딩을 관찰하세요.")
    run(build_graph(model=model), sample_input())
    if hasattr(model, "seen"):
        print(
            "첫 모델 입력에 MEMORY_KO 포함:",
            "MEMORY_KO" in str(model.seen[0][0].content),
        )
