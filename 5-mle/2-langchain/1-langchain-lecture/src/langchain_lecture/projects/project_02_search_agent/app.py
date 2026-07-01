from __future__ import annotations

from langchain_lecture.projects.project_02_search_agent.agent import run_search_agent


DEFAULT_QUERY = (
    "Search for 3 job postings for an AI engineer using LangChain in the Bay Area "
    "and list their details."
)


def main() -> None:
    result = run_search_agent(DEFAULT_QUERY)
    print(result.get("structured_response") or result)


if __name__ == "__main__":
    main()

