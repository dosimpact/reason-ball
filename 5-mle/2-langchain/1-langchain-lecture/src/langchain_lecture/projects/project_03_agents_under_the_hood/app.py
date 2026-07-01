from __future__ import annotations

from langchain_lecture.projects.project_03_agents_under_the_hood.langchain_tool_calling import (
    run_agent,
)


def main() -> None:
    result = run_agent("What is the price of a laptop after applying a gold discount?")
    print(result)


if __name__ == "__main__":
    main()

