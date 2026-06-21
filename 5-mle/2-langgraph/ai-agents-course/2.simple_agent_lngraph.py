"""
A minimal LangGraph example.
This file sets up:
- shared conversation state (`messages`)
- a single chatbot node
- a graph entry and finish node
"""

import os
from typing import Annotated, TypedDict
from dotenv import load_dotenv

from openai import OpenAI
from langchain_openai import ChatOpenAI

from langgraph.graph import StateGraph, END


# Load environment variables from .env file
load_dotenv()

# Get API key from environment. This keeps credentials out of source code.
openai_key = os.getenv("OPENAI_API_KEY")

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


def bot(state: State):
    # print(state.items())
    # Forward all current messages to the LLM and return appended assistant message.
    print(state["messages"])
    return {"messages": [model.invoke(state["messages"])]}


def _prompt_or_none(prompt: str):
    try:
        return input(prompt).strip()
    except EOFError:
        print(f"{prompt}[stdin unavailable]")
        return None


graph_builder = StateGraph(State)

# The first argument is the unique node name
# The second argument is the function or object that will be called whenever
# the node is used.
graph_builder.add_node("bot", bot)


# STEP 3: Add an entry point to the graph
graph_builder.set_entry_point("bot")

# STEP 4: and end point to the graph
graph_builder.set_finish_point("bot")


# STEP 5: Compile the graph
# Compile turns the builder into an executable graph.
graph = graph_builder.compile()

# res = graph.invoke({"messages": ["Hello, how are you?"]})
# print(res["messages"])

# Simple REPL loop:
# - user input -> graph.stream -> print latest response
# - type quit/exit/q to stop
while True:
    user_input = _prompt_or_none("User: ")
    if user_input is None or user_input == "":
        print("No input. Exiting loop.")
        break
    if user_input.lower() in ["quit", "exit", "q"]:
        print("Goodbye!")
        break
    for event in graph.stream({"messages": ("user", user_input)}):
        for value in event.values():
            print("Assistant:", value["messages"][-1].content)
