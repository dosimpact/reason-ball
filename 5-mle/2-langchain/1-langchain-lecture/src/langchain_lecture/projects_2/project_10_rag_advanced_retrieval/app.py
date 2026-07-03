"""청킹, 검색기 조합, 평가를 포함한 고급 RAG 검색 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.rag_chain import (
    format_response,
    run_rag,
)


# 예제 실행 진입점입니다.
def main() -> None:
    question = "챗봇 응답이 느려질 때 어떤 운영 지표를 확인해야 하나요?"
    for strategy in ("baseline", "rewrite", "multi_query", "compression", "rerank"):
        print("=" * 80)
        print(format_response(run_rag(question, strategy=strategy)))  # type: ignore[arg-type]


if __name__ == "__main__":
    main()
