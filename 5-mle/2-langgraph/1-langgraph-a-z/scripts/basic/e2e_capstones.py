"""Run live LangGraph API E2E checks for the integrated capstones.

Start the server first:

    uv run langgraph dev --port 2025 --no-browser
    uv run python scripts/e2e_capstones.py

The server loads ``.env``. This client never reads or prints secret values.
"""

from __future__ import annotations

import argparse
import json

from langgraph_sdk import get_sync_client


def _run(base_url: str, include_web: bool, require_live_web: bool) -> list[dict]:
    client = get_sync_client(url=base_url)
    results: list[dict] = []

    reflexion = client.runs.wait(
        None,
        "b_45_research_reflexion",
        input={
            "question": (
                "LangGraph checkpoint가 운영 환경에서 필요한 이유와 주요 장점을 "
                "근거와 함께 설명해줘."
            )
        },
    )
    assert reflexion.get("answer"), "45: answer is empty"
    assert reflexion.get("evidence"), "45: no evidence was retrieved"
    assert reflexion.get("citations"), "45: revised answer has no citations"
    assert 1 <= reflexion.get("attempts", 0) <= 3, "45: invalid attempt count"
    results.append(
        {
            "graph": "b_45_research_reflexion",
            "attempts": reflexion["attempts"],
            "ready": reflexion.get("ready"),
            "citations": reflexion["citations"],
            "evidence_ids": [item["id"] for item in reflexion["evidence"]],
        }
    )

    local_rag = client.runs.wait(
        None,
        "b_46_agentic_rag",
        input={"question": "LangGraph checkpoint는 중단된 실행을 어떻게 재개하게 해주나요?"},
    )
    assert local_rag.get("datasource") == "local", "46: local query was misrouted"
    assert local_rag.get("documents"), "46: local retrieval returned no documents"
    assert local_rag.get("grounded") is True, "46: local answer is not grounded"
    assert local_rag.get("useful") is True, "46: local answer is not useful"
    results.append(
        {
            "graph": "b_46_agentic_rag",
            "branch": "local",
            "attempts": local_rag["attempts"],
            "document_ids": [item["id"] for item in local_rag["documents"]],
            "grounded": local_rag["grounded"],
            "useful": local_rag["useful"],
        }
    )

    if include_web:
        web_rag = client.runs.wait(
            None,
            "b_46_agentic_rag",
            input={"question": "For current events, why is web search appropriate?"},
        )
        assert web_rag.get("datasource") == "web", "46: web query was misrouted"
        assert web_rag.get("documents"), "46: web search and fallback both returned no documents"
        assert web_rag.get("grounded") is True, "46: web answer is not grounded"
        assert web_rag.get("useful") is True, "46: web answer is not useful"
        sources = [item["source"] for item in web_rag["documents"]]
        if require_live_web:
            assert any(source != "demo-web" for source in sources), (
                "46: live Tavily search was unavailable; check TAVILY_API_KEY"
            )
        results.append(
            {
                "graph": "b_46_agentic_rag",
                "branch": "web",
                "attempts": web_rag["attempts"],
                "sources": sources,
                "grounded": web_rag["grounded"],
                "useful": web_rag["useful"],
            }
        )

    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:2025")
    parser.add_argument("--include-web", action="store_true")
    parser.add_argument("--require-live-web", action="store_true")
    args = parser.parse_args()

    include_web = args.include_web or args.require_live_web
    results = _run(args.base_url, include_web, args.require_live_web)
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
