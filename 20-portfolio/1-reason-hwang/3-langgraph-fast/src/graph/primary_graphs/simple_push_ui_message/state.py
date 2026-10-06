from typing import Annotated

from langgraph.graph import MessagesState
from langgraph.graph.ui import AnyUIMessage, ui_message_reducer


class PushUIState(MessagesState):
    ui: Annotated[list[AnyUIMessage], ui_message_reducer]
    turn_id: str
    model_calls: int
