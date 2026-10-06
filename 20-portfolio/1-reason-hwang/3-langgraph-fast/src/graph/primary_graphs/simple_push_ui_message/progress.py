from uuid import uuid4

from langchain_core.messages import AIMessage
from langgraph.graph.ui import push_ui_message


def progress(turn_id: str, title: str, status: str = "running", *, step_id: str | None = None):
    return push_ui_message(
        "turn_progress", {"title": title, "status": status},
        id=step_id or str(uuid4()), merge=step_id is not None,
        message=AIMessage(content="", id=turn_id),
    )
