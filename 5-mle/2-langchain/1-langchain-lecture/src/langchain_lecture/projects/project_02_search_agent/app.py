"""검색 도구를 사용하는 LangChain 에이전트 흐름을 보여주는 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects.project_02_search_agent.agent import run_search_agent


DEFAULT_QUERY = (
    "Search for 3 job postings for an AI engineer using LangChain in the Bay Area "
    "and list their details."
)


# 예제 실행 진입점입니다.
def main() -> None:
    result = run_search_agent(DEFAULT_QUERY)
    print(result.get("structured_response") or result)


if __name__ == "__main__":
    main()

