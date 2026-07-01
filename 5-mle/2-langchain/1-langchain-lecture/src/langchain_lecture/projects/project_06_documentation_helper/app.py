from __future__ import annotations

from langchain_lecture.projects.project_06_documentation_helper.backend import run_llm


def main() -> None:
    result = run_llm("What are LangChain agents?")
    print(result["answer"])


if __name__ == "__main__":
    main()

