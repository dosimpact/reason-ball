"""11 — 대화 요약

쉽게 이해하기
-------------
대화 요약은 오래된 내용을 짧게 정리하고 최근 대화와 함께 사용하는 방식이다.
예: 앞서 정한 보고서 목적을 요약해 다음 작업에 참고한다.
이 예제는 모델 입력이 줄어드는지와 원문 history가 파일에 보관되는지 함께 확인한다.

학습 목표: Deep Agents 요약 middleware를 교체해 낮은 임계값으로 실행, history 보존 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/3-memory_and_context/11_conversation_summary.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
긴 대화의 오래된 부분을 요약하고 원문 이력을 파일로 보존해, 줄어든 모델 입력으로 답변한다.

테스트 입력 예시
----------------
관찰할 결과: 요약 모델 호출, 줄어든 모델 입력, /conversation_history/의 원문 보관을 확인합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
입력(Python): sample_input()을 graph.invoke에 전달합니다. 이 함수가 해당 예제의 지침/skill 파일 또는 긴 대화를 함께 준비합니다.
Studio 입력 JSON 출력: uv run --extra deep-agents python -m scripts.deep_agents.example_input 11
"""

from __future__ import annotations

from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from deepagents.middleware.summarization import SummarizationMiddleware
from langchain_core.messages import AIMessage, HumanMessage

from common.deep_agents.demo import run
from common.deep_agents.model import create_model

PROMPT = "앞서 정한 보고서 대상과 다음 작업을 말해줘."


def sample_input():
    history = []
    for i in range(8):
        history.extend(
            [
                HumanMessage(content=f"{i}: 대상은 A/B 비교 보고서. " * 10),
                AIMessage(content=f"{i}: 원문을 보존하고 비교 표 작성 예정. " * 10),
            ]
        )
    return {"messages": [*history, HumanMessage(content=PROMPT)]}


def build_graph(model=None, summary_model=None):
    backend = StateBackend()
    summary_model = summary_model or create_model(
        answer="대상: A/B 비교 보고서. 다음 작업: 비교 표 작성."
    )
    return create_deep_agent(
        model=model or create_model(answer="A/B 비교 보고서의 표를 작성합니다."),
        backend=backend,
        middleware=[
            SummarizationMiddleware(
                model=summary_model,
                backend=backend,
                trigger=("messages", 10),
                keep=("messages", 4),
            )
        ],
        name="conversation_summary",
    )


graph = build_graph()

if __name__ == "__main__":
    model = create_model(answer="A/B 비교 보고서의 표를 작성합니다.")
    summary_model = create_model(answer="대상: A/B 비교 보고서. 다음 작업: 비교 표 작성.")
    data = sample_input()
    run(build_graph(model=model, summary_model=summary_model), data)
    if hasattr(model, "seen"):
        print("입력 대화 수:", len(data["messages"]))
        print("요약 후 모델 입력 수 (system 포함):", len(model.seen[0]))
        print("요약 모델 호출 횟수:", len(summary_model.seen))
