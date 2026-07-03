"""Python 실행 도구와 CSV 분석 도구를 라우팅하는 코드 인터프리터 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects.project_05_code_interpreter.agent import build_router_agent


# 예제 실행 진입점입니다.
def main() -> None:
    agent = build_router_agent()
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "Generate Python code that computes 15 * 17 and report the result.",
                }
            ]
        }
    )
    print(result["messages"][-1].content)


if __name__ == "__main__":
    main()

