"""
Example 16 — LangChain create_agent로 ReAct graph 만들기.

선행 예제
---------
- 15_react_tool_loop

새 개념
-------
- `create_agent()`가 model → tools → model loop를 구성
- 직접 만든 ReAct graph와 prebuilt agent factory 비교
- 반환된 compiled graph를 그대로 Studio entrypoint로 노출

복습 개념
---------
- tool binding, ToolNode, ReAct cycle

그래프 구조
-----------
START ─▶ model ─┬─▶ tools ─▶ model
                 └─▶ END
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
