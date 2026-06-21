"""
LangGraph-based chatbot with a web search tool.
It shows:
- build a simple state graph
- attach a tool (Tavily search)
- let the graph decide whether to answer directly or call a tool
"""

import os
from typing import Annotated, TypedDict
from dotenv import load_dotenv

from openai import OpenAI, APIConnectionError
from langchain_openai import ChatOpenAI

from langgraph.graph import StateGraph, END
from langchain_community.tools.tavily_search import TavilySearchResults


# Load environment variables from .env file
load_dotenv()

# Read API keys from environment.
# OPENAI_API_KEY is required for ChatOpenAI,
# TAVILY_API_KEY is required only if you want web search tool calls to work.
openai_key = os.getenv("OPENAI_API_KEY")
if not openai_key:
    raise RuntimeError("OPENAI_API_KEY is missing. Set it in .env or environment variables.")
tavily = os.getenv("TAVILY_API_KEY")


llm_name = "gpt-4o-mini"

client = OpenAI(api_key=openai_key)
model = ChatOpenAI(api_key=openai_key, model=llm_name)
tool = None


# STEP 1: Build a Basic Chatbot
from langgraph.graph.message import add_messages


class State(TypedDict):
    # Messages have the type "list". The `add_messages` function
    # in the annotation defines how this state key should be updated
    # (in this case, it appends messages to the list, rather than overwriting them)
    messages: Annotated[list, add_messages]


graph_builder = StateGraph(State)

# create tools
# Tool wrapper lets the model ask for "TavilySearchResults" when web search is needed.
tools = []
if tavily:
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
            if "messages" in event:
                event["messages"][-1].pretty_print()
    except APIConnectionError as exc:
        print(f"[network] {label}: {type(exc).__name__} - {exc}")
    except Exception as exc:
        print(f"[error] {label}: {type(exc).__name__} - {exc}")


def bot(state: State):
    # print(state.items())
    # Pass current conversation history to the model.
    # Because model_with_tools is bound to tools, it can return tool_calls.
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
try:
    from langgraph.checkpoint.sqlite import SqliteSaver
except Exception:
    from langgraph.checkpoint.memory import MemorySaver
    SqliteSaver = None

if SqliteSaver is not None:
    memory = SqliteSaver.from_conn_string(":memory:")
else:
    # Fallback when sqlite checkpoint module is unavailable in this environment.
    memory = MemorySaver()

# STEP 5: Compile the graph
# `interrupt_before=["tools"]` pauses before running tools.
# This is useful for demos so you can inspect what tool will be called.
graph_kwargs = {"checkpointer": memory}
if tools:
    graph_kwargs["interrupt_before"] = ["tools"]

graph = graph_builder.compile(**graph_kwargs)
# MEMORY CODE CONTINUES ===
# Now we can run the chatbot and see how it behaves
# PICK A TRHEAD FIRST
config = {
    "configurable": {"thread_id": 1}
}  # a thread where the agent will dump its memory to
user_input = "I'm learning about astrology. Could you do some research on it for me?"

# The config is the **second positional argument** to stream() or invoke()!
# The first step sends one user query and stores conversation under thread_id=1.
events = graph.stream(
    {"messages": [("user", user_input)]}, config, stream_mode="values"
)
_safe_stream("first turn", events)

# inspect the state
snapshot = graph.get_state(config)
next_step = snapshot.next
# this will show "action", because we've interrupted the flow before the tools node

print(
    "===>>>", next_step
)  # this will show "action", because we've interrupted the flow before the tools node

if tools:
    existing_message = snapshot.values["messages"][-1]
    all_tools = getattr(existing_message, "tool_calls", [])

    print("tools to be called::", all_tools)
else:
    print("No tool node is enabled; no tool calls will be executed.")

# Continue the conversation passing None to say continue - all is good
# `None` will append nothing new to the current state, letting it resume as if it had never been interrupted
# We already know a tool was requested, so continue now without adding a new user message.
if tools:
    events = graph.stream(None, config, stream_mode="values")
    _safe_stream("tool resume", events)
