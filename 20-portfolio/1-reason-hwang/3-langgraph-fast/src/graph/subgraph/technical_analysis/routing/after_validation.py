from __future__ import annotations

from typing import Literal

from graph.subgraph.technical_analysis.state import TechnicalAnalysisState


def route_after_validation(
    state: TechnicalAnalysisState,
) -> Literal["call_model", "render_input_error"]:
    return "render_input_error" if state.get("validation_errors") else "call_model"
