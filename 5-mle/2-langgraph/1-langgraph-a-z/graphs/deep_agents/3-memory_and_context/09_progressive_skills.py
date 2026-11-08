"""09 — Skills 점진적 로딩

쉽게 이해하기
-------------
Skill은 필요할 때 찾아 읽는 작업 안내서다.
예: 보고서를 작성할 때 report skill의 자세한 절차를 읽는다.
처음에는 설명 목록을 주고 실제 작업 시 read_file로 본문을 읽게 한다.

학습 목표: 목록에는 설명만 주입되고 본문은 read_file로 읽는 과정을 관찰.
실행: uv run --extra deep-agents python graphs/deep_agents/3-memory_and_context/09_progressive_skills.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
skill 설명 목록을 모델에 제공하고, 필요한 skill 본문을 read_file로 읽은 뒤 답변에 활용한다.

테스트 입력 예시
----------------
관찰할 결과: 초기에는 skill 설명을 보고 read_file 후에 REPORT_SKILL_APPLIED 본문을 읽는 순서를 확인합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
입력(Python): sample_input()을 graph.invoke에 전달합니다. 이 함수가 해당 예제의 지침/skill 파일 또는 긴 대화를 함께 준비합니다.
Studio 입력 JSON 출력: uv run --extra deep-agents python -m scripts.deep_agents.example_input 9
"""

from __future__ import annotations

from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data

from common.deep_agents.demo import run
from common.deep_agents.model import ROOT, call, create_model

PROMPT = "report skill을 읽고 A/B 비교 보고서를 작성해줘. A=10, B=20은 제공된 연습 수치야."
SKILL_PATH = "/skills/report/SKILL.md"


def sample_input():
    return {
        "messages": [("user", PROMPT)],
        "files": {
            SKILL_PATH: create_file_data(
                (ROOT / "assets/deep_agents/skills/report/SKILL.md").read_text()
            ),
        },
    }


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [[call("read_file", file_path=SKILL_PATH)]],
            answer="A=10, B=20. REPORT_SKILL_APPLIED",
        ),
        skills=["/skills/"],
        name="progressive_skills",
    )


graph = build_graph()

if __name__ == "__main__":
    model = create_model([[call("read_file", file_path=SKILL_PATH)]])
    run(build_graph(model=model), sample_input())
    if hasattr(model, "seen"):
        print(
            "첫 모델 입력에 skill 본문 포함:",
            "REPORT_SKILL_APPLIED" in str(model.seen[0]),
        )
        print("도구 호출 후 본문 포함:", "REPORT_SKILL_APPLIED" in str(model.seen[-1]))
