"""
Example 26 — LangChain ``create_agent``.

``create_agent`` 는 모델이 최종 답변을 만들 때까지
model → tools → model 루프를 실행하는 LangGraph 그래프를 반환합니다.
따라서 별도의 ``StateGraph`` 로 감싸지 않고 반환값을 그대로 graph 로 공개합니다.

그래프 구조
-----------
START ─▶ model ─┬─▶ tools ─▶ model
                 └─▶ END

테스트 입력 예시 (LangGraph Studio / invoke)
-----------------------------------------------
▶ tool 사용
   - {"messages": [{"role": "user", "content": "12 * 7을 계산해줘."}]}
   - {"messages": [{"role": "user", "content": "LangGraph가 뭐야?"}]}
▶ tool 없이 종료
   - {"messages": [{"role": "user", "content": "안녕! 한 문장으로 인사해줘."}]}
"""

from __future__ import annotations

from langchain.agents import create_agent

from common.llm import create_llm
from common.tools import TOOLS

SYSTEM_PROMPT = """
당신은 간결하고 정확한 한국어 어시스턴트입니다.
시간, 계산, 등록된 주제 조회가 필요하면 추측하지 말고 제공된 도구를 사용하세요.
""".strip()


def build_graph():
    """LangChain agent factory가 컴파일한 LangGraph를 생성합니다."""
    return create_agent(
        model=create_llm(),
        tools=TOOLS,
        system_prompt=SYSTEM_PROMPT,
        name="basic_create_agent",
    )


graph = build_graph()


if __name__ == "__main__":
    result = graph.invoke(
        {"messages": [{"role": "user", "content": "12 * 7을 계산해줘."}]}
    )
    result["messages"][-1].pretty_print()
