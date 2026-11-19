"""Canvas state extends the original TA calculation contract."""
from typing import NotRequired

from graph.primary_graphs.technical_analysis_agent.state import TechnicalAgentState


class TechnicalCanvasAgentState(TechnicalAgentState):
    canvas_context: NotRequired[dict | None]
    canvas_reports: NotRequired[dict]
    canvas_route: NotRequired[str]
    canvas_report_id: NotRequired[str | None]
