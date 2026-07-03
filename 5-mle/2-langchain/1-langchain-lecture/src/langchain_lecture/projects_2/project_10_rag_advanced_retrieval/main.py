"""청킹, 검색기 조합, 평가를 포함한 고급 RAG 검색 예제입니다. 패키지 예제를 실행하기 위한 얇은 진입점입니다."""

from __future__ import annotations

import argparse

from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.rag_chain import (
    format_response,
    run_rag,
)


# 예제 실행 진입점입니다.
def main() -> None:
    parser = argparse.ArgumentParser(description="Offline advanced retrieval RAG demo.")
    parser.add_argument("question", nargs="?", default="검색 결과가 부족하면 어떻게 답해야 하나요?")
    parser.add_argument(
        "--strategy",
        choices=["baseline", "rewrite", "multi_query", "hybrid", "compression", "rerank"],
        default="rerank",
    )
    args = parser.parse_args()
    print(format_response(run_rag(args.question, strategy=args.strategy)))


if __name__ == "__main__":
    main()
