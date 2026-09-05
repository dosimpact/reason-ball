from __future__ import annotations

from langchain_core.messages import AIMessage

from graph.subgraph.technical_analysis.state import TechnicalAnalysisState


def render_input_error(state: TechnicalAnalysisState) -> dict[str, object]:
    errors = state.get("validation_errors") or ["Unknown OHLCV validation error"]
    detail = "\n".join(f"- {error}" for error in errors)
    return {
        "messages": [
            AIMessage(
                content=(
                    "OHLCV 입력을 검증하지 못해 기술적 분석을 실행하지 않았습니다.\n"
                    f"{detail}"
                )
            )
        ]
    }
