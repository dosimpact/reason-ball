"""문서 수집, 검색, 답변 생성을 묶은 문서 도우미 RAG 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects.project_06_documentation_helper.backend import run_llm


# 예제 실행 진입점입니다.
def main() -> None:
    result = run_llm("What are LangChain agents?")
    print(result["answer"])


if __name__ == "__main__":
    main()

