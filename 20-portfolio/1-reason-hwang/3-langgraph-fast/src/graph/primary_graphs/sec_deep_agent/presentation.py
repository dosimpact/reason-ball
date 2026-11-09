"""SEC research followed by the same final-output subgraph as the other UIs."""
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from domains.sec_chat.conversation import ConversationRequest
from graph.subgraphs.openui_output.workflow import build_output_graph


class ResearchUIState(TypedDict, total=False):
    request: ConversationRequest
    question: str
    answer: dict
    host_evidence: bool
    program: str


def build_research_ui_graph(research, model, *, activity=None, validator=None):
    async def investigate(state: ResearchUIState):
        request = state['request']
        return {'question': request.message, 'answer': await research(request, activity), 'host_evidence': False}

    graph = StateGraph(ResearchUIState)
    graph.add_node('research', investigate)
    graph.add_node('openui_output', build_output_graph(model, validator=validator))
    graph.add_edge(START, 'research')
    graph.add_edge('research', 'openui_output')
    graph.add_edge('openui_output', END)
    return graph.compile()
