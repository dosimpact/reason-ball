"""에이전트 루프와 도구 호출이 내부적으로 어떻게 이어지는지 보여주는 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects.project_03_agents_under_the_hood.langchain_tool_calling import (
    run_agent,
)


# 예제 실행 진입점입니다.
def main() -> None:
    result = run_agent("What is the price of a laptop after applying a gold discount?")
    print(result)


if __name__ == "__main__":
    main()

