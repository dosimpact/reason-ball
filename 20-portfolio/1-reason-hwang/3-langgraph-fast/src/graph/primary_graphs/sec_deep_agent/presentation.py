"""SEC research followed by the same final-output subgraph as the other UIs."""
import json
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
        request = state.get('request')
        if request is None:
            raise ValueError('Research request is required')
        return {'question': request.message, 'answer': await research(request, activity), 'host_evidence': False}

    graph = StateGraph(ResearchUIState)
    graph.add_node('research', investigate)
    ordinary_output = build_output_graph(model, validator=validator)

    async def present(state: ResearchUIState):
        answer = state.get('answer')
        if answer is None:
            raise ValueError('Research answer is required')
        if 'financialVerification' not in answer:
            return await ordinary_output.ainvoke({'question': state.get('question', ''), 'answer': answer, 'host_evidence': False})
        # Financial results are server-owned: a second model must not alter the
        # checked amounts, their basis, or the explicit unverified warnings.
        from graph.subgraphs.openui_output.workflow import validate_program
        program = 'root = Markdown(' + json.dumps(answer['report'], ensure_ascii=False) + ')'
        errors = await (validator or validate_program)(program)
        if errors:
            raise ValueError('Financial report OpenUI validation failed')
        return {'program': program}

    graph.add_node('openui_output', present)
    graph.add_edge(START, 'research')
    graph.add_edge('research', 'openui_output')
    graph.add_edge('openui_output', END)
    return graph.compile()
