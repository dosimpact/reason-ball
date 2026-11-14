from typing import NotRequired

from deepagents.graph import DeepAgentState


class SecModelingAgentState(DeepAgentState):
    """Retain native chat messages while clearing any prior presentation per turn."""

    presentation: NotRequired[dict | None]
