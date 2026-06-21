"""
LangGraph tool-calling example with memory.
Useful for understanding:
- binding tools to the model
- conditional edge: call tool or return final answer
- stateful conversation memory across turns (thread_id-based)
"""

import os
from typing import Annotated, TypedDict
from dotenv import load_dotenv

from openai import OpenAI
from openai import APIConnectionError
from langchain_openai import ChatOpenAI

from langgraph.graph import StateGraph, END
from langchain_community.tools.tavily_search import TavilySearchResults


# Load environment variables from .env file
load_dotenv()

# API keys are loaded from environment.
# Set these in .env before running this script.
openai_key = os.getenv("OPENAI_API_KEY")
if not openai_key:
    raise RuntimeError("OPENAI_API_KEY is missing. Set it in .env or environment variables.")
tavily = os.getenv("TAVILY_API_KEY")


llm_name = "gpt-4o-mini"

client = OpenAI(api_key=openai_key)
model = ChatOpenAI(api_key=openai_key, model=llm_name)


# STEP 1: Build a Basic Chatbot
from langgraph.graph.message import add_messages


class State(TypedDict):
    # Messages have the type "list". The `add_messages` function
    # in the annotation defines how this state key should be updated
    # (in this case, it appends messages to the list, rather than overwriting them)
    messages: Annotated[list, add_messages]


graph_builder = StateGraph(State)

# create tools
# Tool will perform web search when model chooses to use it.
tools = []
if tavily:
    # Tooling is optional; skip silently if key is missing/unusable.
    try:
        tool = TavilySearchResults(max_results=2)
        tools = [tool]
        print("[info] TavilySearchResults enabled.")
    except Exception as exc:
        print(f"[warn] TavilySearchResults init failed: {type(exc).__name__}: {exc}")
else:
    print("[warn] TAVILY_API_KEY is not set. Running without web search tool.")

model_with_tools = model.bind_tools(tools) if tools else model

# Below, implement a BasicToolNode that checks the most recent
# message in the state and calls tools if the message contains tool_calls
import json
from langchain_core.messages import ToolMessage
from langgraph.prebuilt import ToolNode, tools_condition


def _safe_stream(label, events):
    try:
        for event in events:
            event["messages"][-1].pretty_print()
    except APIConnectionError as exc:
        print(f"[network] {label}: {type(exc).__name__} - {exc}")
        return
    except Exception as exc:
        print(f"[error] {label}: {type(exc).__name__} - {exc}")
        return


def bot(state: State):
    # print(state.items())
    # Model sees message history and can request a tool call (tool_calls).
    print(state["messages"])
    return {"messages": [model_with_tools.invoke(state["messages"])]}


# instantiate the ToolNode with the tools
if tools:
    tool_node = ToolNode(tools=tools)
    graph_builder.add_node("tools", tool_node)  # Add the node to the graph

    # The `tools_condition` function returns "tools" if the chatbot asks to use a tool, and "__end__" if
    # it is fine directly responding. This conditional routing defines the main agent loop.
    graph_builder.add_conditional_edges(
        "bot",
        tools_condition,
    )
else:
    graph_builder.add_edge("bot", END)

# The first argument is the unique node name
# The second argument is the function or object that will be called whenever
# the node is used.
graph_builder.add_node("bot", bot)


# STEP 3: Add an entry point to the graph
graph_builder.set_entry_point("bot")

# ADD MEMORY NODE
# from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.memory import MemorySaver

# memory = SqliteSaver.from_conn_string(":memory:")
memory = MemorySaver()

# memory = InMemoryStore()
# STEP 5: Compile the graph
# graph = graph_builder.compile(checkpointer=memory) # no need for checkpointer memory anymore
# With MemorySaver, short-term memory is kept in process so follow-up messages keep context.
graph = graph_builder.compile(
    checkpointer=memory
)  # no need for checkpointer memory anymore
# MEMORY CODE CONTINUES ===
# Now we can run the chatbot and see how it behaves
# PICK A TRHEAD FIRST
config = {
    "configurable": {"thread_id": 1}
}  # a thread where the agent will dump its memory to
user_input = "Hi there! My name is Bond. and I have been happy for 100 years"

# The config is the **second positional argument** to stream() or invoke()!
events = graph.stream(
    {"messages": [("user", user_input)]}, config, stream_mode="values"
)

# Print each intermediate event; useful to see tool-routing and final assistant messages.
_safe_stream("first turn", events)


user_input = "do you remember my name, and how long have I been happy for?"

# The config is the **second positional argument** to stream() or invoke()!
events = graph.stream(
    {"messages": [("user", user_input)]}, config, stream_mode="values"
)

_safe_stream("second turn", events)


snapshot = graph.get_state(config)
print(snapshot)


# from langchain_core.messages import BaseMessage

# while True:
#     user_input = input("User: ")
#     if user_input.lower() in ["quit", "exit", "q"]:
#         print("Goodbye!")
#         break
#     for event in graph.stream({"messages": [("user", user_input)]}):
#         for value in event.values():
#             if isinstance(value["messages"][-1], BaseMessage):
#                 print("Assistant:", value["messages"][-1].content)
