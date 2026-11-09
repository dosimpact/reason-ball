from typing import NotRequired

from deepagents.graph import DeepAgentState


class TechnicalAgentState(DeepAgentState):
    prices: NotRequired[list[dict]]
    price_request: NotRequired[dict]
    price_metadata: NotRequired[dict]
    indicators: NotRequired[list[dict]]
    analysis_result: NotRequired[dict | None]
    analysis_error: NotRequired[str | None]
    presentation: NotRequired[dict | None]
