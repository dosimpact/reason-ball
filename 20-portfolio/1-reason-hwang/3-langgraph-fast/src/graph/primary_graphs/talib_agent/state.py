"""Public native messages and private business state have explicit boundaries."""

from deepagents.graph import DeepAgentState
from langgraph.graph import MessagesState
from typing_extensions import TypedDict


class AnalysisData(TypedDict, total=False):
    datasets: dict[str, dict]
    results: dict[str, dict]
    current_result_ids: list[str]
    result_requests: dict[str, dict]
    presentation: dict | None
    followUps: list[str]
    followUpsStatus: str
    analysis_error: str | None


class TalibState(MessagesState, AnalysisData):
    pass


class TalibBusinessState(DeepAgentState, AnalysisData):
    pass
